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

  // Currency
  const currency = invoice.currency_snapshot || 'EUR';

  // Totals
  const totalCents = invoice.total_amount_cents || 0;
  const taxCents = invoice.tax_amount_cents || 0;
  const subtotalCents = invoice.subtotal_cents || totalCents - taxCents;

  const totalAmount = (totalCents / 100).toFixed(2);
  const taxAmount = (taxCents / 100).toFixed(2);
  const subtotalAmount = (subtotalCents / 100).toFixed(2);

  // Business Owner (Seller) details
  const sellerName = profile.business_name || '';
  const sellerSiret = profile.company_reg_number || ''; // SIRET
  const sellerVat = profile.vat_number || '';
  const sellerZip = profile.business_zip || '';
  const sellerCity = profile.business_city || '';
  const sellerAddr = profile.business_address || '';

  // Client (Buyer) details
  const buyerName = invoice.client_name || '';
  const buyerSiret = invoice.client_siret || ''; // Captured via Autocomplete
  const buyerZip = invoice.client_zip || '';
  const buyerCity = invoice.client_city || '';
  const buyerAddr = invoice.client_address || '';

  // Default Tax Rate
  const taxRate = invoice.tax_rate_snapshot || profile.tax_rate || 0;

  // Generate the Factur-X standard XML schema (Basic Profile)
  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:factur-x.eu:1p0:basic</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${invoiceNumber}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${issueDate}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTransaction>
    <!-- SELLER DETAILS (Business Owner) -->
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${escapeXml(sellerName)}</ram:Name>
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${sellerSiret}</ram:ID>
        </ram:SpecifiedLegalOrganization>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${sellerZip}</ram:PostcodeCode>
          <ram:LineOne>${escapeXml(sellerAddr)}</ram:LineOne>
          <ram:CityName>${escapeXml(sellerCity)}</ram:CityName>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>
        ${
          sellerVat
            ? `
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${sellerVat}</ram:ID>
        </ram:SpecifiedTaxRegistration>`
            : ''
        }
      </ram:SellerTradeParty>

      <!-- BUYER DETAILS (Client) -->
      <ram:BuyerTradeParty>
        <ram:Name>${escapeXml(buyerName)}</ram:Name>
        ${
          buyerSiret
            ? `
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${buyerSiret}</ram:ID>
        </ram:SpecifiedLegalOrganization>`
            : ''
        }
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${buyerZip}</ram:PostcodeCode>
          <ram:LineOne>${escapeXml(buyerAddr)}</ram:LineOne>
          <ram:CityName>${escapeXml(buyerCity)}</ram:CityName>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>

    <!-- TRADE DELIVERY -->
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime>
          <udt:DateTimeString format="102">${issueDate}</udt:DateTimeString>
        </ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>

    <!-- FINANCIAL TOTALS & TAX BREAKDOWN -->
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${currency}</ram:ID>
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${taxAmount}</ram:CalculatedAmount>
        <ram:BasisAmount>${subtotalAmount}</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>${taxRate}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${dueDate}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${subtotalAmount}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${subtotalAmount}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${currency}">${taxAmount}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${totalAmount}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${totalAmount}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTransaction>
</rsm:CrossIndustryInvoice>`;
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
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
