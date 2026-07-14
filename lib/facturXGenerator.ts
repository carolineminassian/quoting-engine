export function generateFacturXXML({
  invoice,
  profile
}: {
  invoice: any;
  profile: any;
}): string {
  const invoiceNumber = invoice.invoice_number;
  const issueDate = new Date(invoice.invoice_date)
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '');
  const dueDate = invoice.due_date
    ? new Date(invoice.due_date).toISOString().slice(0, 10).replace(/-/g, '')
    : issueDate;

  const currency = invoice.currency_snapshot || 'EUR';

  const sellerName = profile.business_name || '';
  const rawSellerSiret = (
    profile.company_reg_number || '00000000000000'
  ).replace(/\s/g, '');
  const sellerSiren = rawSellerSiret.slice(0, 9).padEnd(9, '0');
  const sellerVat = profile.vat_number || '';
  const sellerZip = profile.business_zip || '';
  const sellerCity = profile.business_city || '';
  const sellerAddr = profile.business_address || '';
  const sellerEmail = profile.contact_email || 'billing@pactestim.com';

  const buyerName = invoice.client_name || '';
  const rawBuyerSiret = (invoice.client_siret || '00000000000000').replace(
    /\s/g,
    ''
  );
  const buyerSiren = rawBuyerSiret.slice(0, 9).padEnd(9, '0');
  const buyerZip = invoice.client_zip || '';
  const buyerCity = invoice.client_city || '';
  const buyerAddr = invoice.client_address || '';
  const buyerEmail = invoice.client_email || 'client@pactestim.com';

  const globalTaxRate = invoice.tax_rate_snapshot || profile.tax_rate || 0;

  // Track dynamic totals from lines to ensure strict Schematron math compliance
  let lineItemsXml = '';
  let calculatedSubtotal = 0;
  const taxBreakdown: Record<number, number> = {};

  const addTaxBasis = (rate: number, amount: number) => {
    taxBreakdown[rate] = (taxBreakdown[rate] || 0) + amount;
  };

  const hasSections =
    Array.isArray(invoice.sections) && invoice.sections.length > 0;

  if (hasSections) {
    let lineIdx = 1;
    invoice.sections.forEach((sec: any) => {
      if (sec.laborHours > 0) {
        const laborRate = sec.laborRate || 50;
        const laborTotal = sec.laborHours * laborRate;
        calculatedSubtotal += laborTotal;
        const rate = sec.laborTaxRate ?? globalTaxRate;
        addTaxBasis(rate, laborTotal);

        lineItemsXml += `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${lineIdx++}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${escapeXml(sec.title || 'Prestation de service')}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${laborRate.toFixed(2)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="HUR">${sec.laborHours}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>S</ram:CategoryCode>
          <ram:RateApplicablePercent>${rate}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${laborTotal.toFixed(2)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`;
      }

      (sec.items || []).forEach((item: any) => {
        const cost = item.cost || 0;
        const qty = item.qty || 1;
        const itemTotal = cost * qty;
        calculatedSubtotal += itemTotal;
        const rate = item.taxRate ?? globalTaxRate;
        addTaxBasis(rate, itemTotal);

        lineItemsXml += `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${lineIdx++}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${escapeXml(item.name || 'Matériel')}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${cost.toFixed(2)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="C62">${qty}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>S</ram:CategoryCode>
          <ram:RateApplicablePercent>${rate}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${itemTotal.toFixed(2)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`;
      });
    });
  } else if (
    Array.isArray(invoice.line_items) &&
    invoice.line_items.length > 0
  ) {
    invoice.line_items.forEach((item: any, idx: number) => {
      const uPrice = (item.unit_price_cents || 0) / 100;
      const qty = item.quantity || 1;
      const itemTotal = uPrice * qty;
      calculatedSubtotal += itemTotal;
      const rate = item.tax_rate ?? globalTaxRate;
      addTaxBasis(rate, itemTotal);

      lineItemsXml += `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${idx + 1}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${escapeXml(item.description || 'Prestation')}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${uPrice.toFixed(2)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="C62">${qty}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>S</ram:CategoryCode>
          <ram:RateApplicablePercent>${rate}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${itemTotal.toFixed(2)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`;
    });
  } else {
    // Fallback: Use initial totals if no lines are provided
    const subtotalCents =
      invoice.subtotal_cents ||
      invoice.total_amount_cents - invoice.tax_amount_cents ||
      0;
    calculatedSubtotal = subtotalCents / 100;
    addTaxBasis(globalTaxRate, calculatedSubtotal);

    lineItemsXml = `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>1</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${escapeXml(invoice.invoice_description || 'Prestations de services')}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${calculatedSubtotal.toFixed(2)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="C62">1</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>S</ram:CategoryCode>
          <ram:RateApplicablePercent>${globalTaxRate}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${calculatedSubtotal.toFixed(2)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`;
  }

  // Construct Header Taxes dynamically
  let taxAmountTotal = 0;
  let headerTaxesXml = '';
  for (const [rateStr, basis] of Object.entries(taxBreakdown)) {
    const rate = parseFloat(rateStr);
    const taxAmount = basis * (rate / 100);
    taxAmountTotal += taxAmount;

    headerTaxesXml += `
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${taxAmount.toFixed(2)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${basis.toFixed(2)}</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>${rate}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>`;
  }

  const grandTotalAmount = (calculatedSubtotal + taxAmountTotal).toFixed(2);
  const subtotalFormatted = calculatedSubtotal.toFixed(2);
  const taxTotalFormatted = taxAmountTotal.toFixed(2);

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:BusinessProcessSpecifiedDocumentContextParameter>
      <ram:ID>B1</ram:ID>
    </ram:BusinessProcessSpecifiedDocumentContextParameter>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${invoiceNumber}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${issueDate}</udt:DateTimeString>
    </ram:IssueDateTime>
    <ram:IncludedNote>
      <ram:Content>Pénalités de retard : 3x le taux d'intérêt légal. Indemnité forfaitaire de recouvrement : 40€</ram:Content>
      <ram:SubjectCode>PMT</ram:SubjectCode>
    </ram:IncludedNote>
    <ram:IncludedNote>
      <ram:Content>Pénalités de retard applicables (code PMD).</ram:Content>
      <ram:SubjectCode>PMD</ram:SubjectCode>
    </ram:IncludedNote>
    <ram:IncludedNote>
      <ram:Content>Pas d'escompte pour paiement anticipé (Code AAB).</ram:Content>
      <ram:SubjectCode>AAB</ram:SubjectCode>
    </ram:IncludedNote>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>${lineItemsXml}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${escapeXml(sellerName)}</ram:Name>
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${sellerSiren}</ram:ID>
        </ram:SpecifiedLegalOrganization>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${sellerZip}</ram:PostcodeCode>
          <ram:LineOne>${escapeXml(sellerAddr)}</ram:LineOne>
          <ram:CityName>${escapeXml(sellerCity)}</ram:CityName>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>
        <ram:URIUniversalCommunication>
          <ram:URIID schemeID="EM">${sellerEmail}</ram:URIID>
        </ram:URIUniversalCommunication>
        ${
          sellerVat
            ? `
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${sellerVat}</ram:ID>
        </ram:SpecifiedTaxRegistration>`
            : ''
        }
      </ram:SellerTradeParty>

      <ram:BuyerTradeParty>
        <ram:Name>${escapeXml(buyerName)}</ram:Name>
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${buyerSiren}</ram:ID>
        </ram:SpecifiedLegalOrganization>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${buyerZip}</ram:PostcodeCode>
          <ram:LineOne>${escapeXml(buyerAddr)}</ram:LineOne>
          <ram:CityName>${escapeXml(buyerCity)}</ram:CityName>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>
        <ram:URIUniversalCommunication>
          <ram:URIID schemeID="EM">${buyerEmail}</ram:URIID>
        </ram:URIUniversalCommunication>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>

    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime>
          <udt:DateTimeString format="102">${issueDate}</udt:DateTimeString>
        </ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>

    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${currency}</ram:InvoiceCurrencyCode>
      ${headerTaxesXml}
      <ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${dueDate}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${subtotalFormatted}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${subtotalFormatted}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${currency}">${taxTotalFormatted}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${grandTotalAmount}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${grandTotalAmount}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}

function escapeXml(unsafe: string): string {
  return (unsafe || '').replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}
