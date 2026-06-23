import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image
} from '@react-pdf/renderer';

// ============================================================
// TYPES
// ============================================================

interface PreparedItem {
  name: string;
  qty: number;
  unit: string;
  cost: number; // in major units (dollars/euros)
  taxRate: number;
}

interface PreparedSection {
  title: string;
  description: string;
  total: number; // in major units
  hasDetails: boolean;
  laborHours: number;
  laborType?: 'hourly' | 'daily';
  laborRate: number; // in major units
  laborTaxRate: number;
  items: PreparedItem[];
}

interface PreparedCharge {
  name: string;
  isPercentage: boolean;
  percentageRate: number;
  qty: number;
  unit: string;
  costPerUnitCents: number;
  taxRate: number;
  amountCents: number;
  basisLabel: string;
}

interface LineItem {
  description: string;
  quantity: number;
  unit_price_cents: number;
  amount_cents: number;
  tax_rate: number;
}

interface InvoicePDFProps {
  invoice?: any;
  creditNote?: any;
  profile: any;
  lang: any;
  subtotal?: number; // major units
  taxGroups?: [string, number][]; // tax amounts in cents
  grandTotal: number; // major units
  sections?: PreparedSection[];
  additionalCharges?: PreparedCharge[];
  lineItems?: LineItem[]; // For deposit/balance invoices
  isDraft?: boolean; // Show draft watermark
  // Balance invoice deduction row
  fullProjectSubtotal?: number;
  depositSubtotal?: number;
  depositRef?: string;
  depositDate?: string;
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 130, // Increased slightly from 90 to accommodate bank details footer
    paddingHorizontal: 45,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#111827',
    backgroundColor: '#ffffff',
    position: 'relative'
  },
  // === DRAFT WATERMARK ===
  draftWatermark: {
    position: 'absolute',
    top: '35%',
    left: 0,
    right: 0,
    textAlign: 'center',
    transform: 'rotate(-30deg)',
    opacity: 0.05
  },
  draftWatermarkText: {
    fontSize: 120,
    fontWeight: 'bold',
    color: '#000000',
    letterSpacing: 20,
    textTransform: 'uppercase'
  },
  // === LETTERHEAD ===
  letterhead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 14,
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb'
  },
  letterheadLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 16
  },
  logo: {
    height: 40,
    width: 'auto',
    objectFit: 'contain',
    marginRight: 12
  },
  businessName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
    letterSpacing: -0.3
  },
  letterheadRight: {
    alignItems: 'flex-end',
    minWidth: 180
  },
  documentTypeLabel: {
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontWeight: 'bold',
    color: '#9ca3af',
    marginBottom: 6
  },
  documentRef: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827'
  },

  // === METADATA GRID (Invoice Date, Due Date, PO#) ===
  metadataGrid: {
    marginTop: 6,
    width: '100%'
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'baseline',
    marginBottom: 3
  },
  metadataLabel: {
    fontSize: 8,
    color: '#6b7280',
    width: 60,
    textAlign: 'right',
    marginRight: 6
  },
  metadataValue: {
    fontSize: 9,
    color: '#111827',
    fontWeight: 'bold',
    width: 90,
    textAlign: 'right'
  },
  metadataValueOverdue: {
    fontSize: 9,
    color: '#dc2626',
    fontWeight: 'bold',
    width: 90,
    textAlign: 'right'
  },

  // === BILL TO ===
  billToSection: {
    marginBottom: 22
  },
  sectionLabel: {
    fontSize: 7.5,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: 'bold',
    color: '#9ca3af',
    marginBottom: 5
  },
  clientName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 2
  },
  clientLine: {
    fontSize: 9,
    color: '#4b5563',
    lineHeight: 1.4,
    marginBottom: 1
  },

  // === SECTION HEADERS ===
  servicesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 6,
    marginBottom: 4,
    borderBottomWidth: 1.5,
    borderBottomColor: '#374151'
  },
  chargesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 6,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db'
  },
  tableHeaderTextServices: {
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: 'bold',
    color: '#374151'
  },
  tableHeaderTextCharges: {
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: 'bold',
    color: '#9ca3af'
  },

  // === LINE ITEMS TABLE (for deposit/balance invoices) ===
  lineItemsHeader: {
    flexDirection: 'row',
    paddingBottom: 6,
    marginBottom: 4,
    borderBottomWidth: 1.5,
    borderBottomColor: '#374151'
  },
  lineItemHeaderCell: {
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: 'bold',
    color: '#374151'
  },
  lineItemRow: {
    flexDirection: 'row',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    alignItems: 'flex-start'
  },
  lineItemRowLast: {
    flexDirection: 'row',
    paddingVertical: 14,
    borderBottomWidth: 0,
    alignItems: 'flex-start'
  },
  lineItemDescription: {
    flex: 1,
    fontSize: 11,
    color: '#111827',
    paddingRight: 8
  },
  lineItemQty: {
    width: 45,
    fontSize: 10,
    color: '#4b5563',
    textAlign: 'center'
  },
  lineItemUnitPrice: {
    width: 65,
    fontSize: 10,
    color: '#4b5563',
    textAlign: 'right'
  },
  lineItemTax: {
    width: 45,
    fontSize: 10,
    color: '#9ca3af',
    textAlign: 'center'
  },
  lineItemAmount: {
    width: 75,
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'right'
  },

  // === SERVICE ROWS ===
  serviceRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6'
  },
  serviceRowLast: {
    paddingVertical: 14,
    borderBottomWidth: 0
  },
  serviceTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6
  },
  serviceTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#111827',
    flex: 1,
    paddingRight: 12
  },
  serviceAmount: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#111827'
  },
  serviceContentBlock: {
    paddingRight: 80
  },
  serviceDescription: {
    fontSize: 10.5,
    color: '#4b5563',
    lineHeight: 1.5,
    marginBottom: 4
  },
  itemsList: {
    marginTop: 4
  },
  itemLine: {
    fontSize: 9,
    marginBottom: 2
  },
  itemLineName: {
    fontSize: 9,
    color: '#4b5563',
    fontWeight: 'bold'
  },
  itemLineMeta: {
    fontSize: 9,
    color: '#9ca3af'
  },
  detailsBlock: {
    marginTop: 6,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#e5e7eb'
  },
  detailLine: {
    fontSize: 8.5,
    color: '#6b7280',
    marginBottom: 2,
    lineHeight: 1.4
  },

  // === ADDITIONAL CHARGES ROWS ===
  chargeRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6'
  },
  chargeRowLast: {
    paddingVertical: 10,
    borderBottomWidth: 0
  },
  chargeTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  chargeInfoBlock: {
    flex: 1,
    paddingRight: 12,
    flexDirection: 'column'
  },
  chargeName: {
    fontSize: 11.5,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 2
  },
  chargeAmount: {
    fontSize: 11.5,
    fontWeight: 'bold',
    color: '#111827'
  },
  chargeSubtitle: {
    fontSize: 8.5,
    color: '#6b7280',
    marginTop: 2
  },

  // === SIMPLE TEXT BLOCKS (For Notes / Reasons) ===
  textBlockRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6'
  },
  textBlockDescription: {
    fontSize: 10.5,
    color: '#4b5563',
    lineHeight: 1.5
  },

  sectionSpacer: {
    marginBottom: 24
  },

  // === TOTALS ===
  totalsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 10,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb'
  },
  totalsBox: {
    width: 240
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6
  },
  totalLabel: {
    fontSize: 10,
    color: '#6b7280'
  },
  totalValue: {
    fontSize: 10,
    color: '#111827',
    fontWeight: 'bold'
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingTop: 9,
    marginTop: 4,
    borderTopWidth: 1.5,
    borderTopColor: '#374151'
  },
  grandTotalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: '#111827',
    letterSpacing: 0.5
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: 'bold'
  },

  // === DEPOSIT BREAKDOWN ===
  depositDivider: {
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: '#d1d5db',
    borderTopStyle: 'dashed'
  },
  depositRowPill: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    backgroundColor: '#eff6ff',
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 4,
    borderRadius: 3
  },
  depositLabel: {
    fontSize: 9.5,
    color: '#2563eb',
    fontWeight: 'bold'
  },
  depositValue: {
    fontSize: 10,
    color: '#2563eb',
    fontWeight: 'bold'
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 8,
    marginTop: 2
  },
  balanceLabel: {
    fontSize: 9.5,
    color: '#6b7280'
  },
  balanceValue: {
    fontSize: 10,
    color: '#374151',
    fontWeight: 'bold'
  },

  // === FOOTER ===
  footer: {
    position: 'absolute',
    bottom: 14,
    left: 45,
    right: 45,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    flexDirection: 'column'
  },
  footerBlock: {
    width: '47%'
  },
  footerBlockCenter: {
    flex: 1,
    alignItems: 'center'
  },
  footerTitle: {
    fontSize: 7.5,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: '#9ca3af',
    marginBottom: 5
  },
  footerText: {
    fontSize: 8,
    color: '#9ca3af',
    lineHeight: 1.5,
    fontStyle: 'italic'
  },
  footerTextRight: {
    fontStyle: 'normal',
    fontWeight: 'bold'
  }
});

// ============================================================
// COMPONENT
// ============================================================

export default function InvoicePDF({
  invoice,
  creditNote,
  profile,
  lang,
  subtotal = 0,
  taxGroups = [],
  grandTotal,
  sections = [],
  additionalCharges = [],
  lineItems = [],
  isDraft = false,
  fullProjectSubtotal = 0,
  depositSubtotal = 0,
  depositRef,
  depositDate
}: InvoicePDFProps) {
  const isFr = profile.country === 'FR';
  const currencySymbol = profile.currency === 'EUR' ? '€' : '$';
  const locale = isFr ? 'fr-FR' : 'en-US';

  const isCredit = !!creditNote;
  const docData = isCredit ? creditNote : invoice;
  const primaryColor = isCredit ? '#7e22ce' : '#2563eb';

  // Document title with draft indicator
  const baseDocTitle = isCredit
    ? isFr
      ? 'Avoir'
      : 'Credit Note'
    : docData?.invoice_type === 'deposit'
      ? isFr
        ? "Facture d'Acompte"
        : 'Deposit Invoice'
      : docData?.invoice_type === 'balance'
        ? isFr
          ? 'Facture de Solde'
          : 'Balance Invoice'
        : isFr
          ? 'Facture'
          : 'Invoice';

  const docNumber = isCredit
    ? docData.credit_note_number
    : docData.invoice_number;
  const docDate = isCredit ? docData.credit_note_date : docData.invoice_date;

  const formatPrice = (value: number): string => {
    const formatted = value.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    const safe = formatted.replace(/[\u202F\u00A0]/g, ' ');
    return `${currencySymbol}${safe}`;
  };

  const formatCents = (cents: number): string => formatPrice(cents / 100);

  const showLogo =
    profile.subscription_tier === 'pro' &&
    typeof profile.logo_url === 'string' &&
    profile.logo_url.length > 0;

  const formattedInvoiceDate = docDate
    ? new Date(docDate).toLocaleDateString(locale, {
        year: 'numeric',
        month: 'long', // Aligned with estimate (long month name)
        day: 'numeric'
      })
    : '';

  const formattedDueDate = docData?.due_date
    ? new Date(docData.due_date).toLocaleDateString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : '';

  // Check if overdue
  const isOverdue =
    !isCredit &&
    docData?.due_date &&
    docData?.payment_status !== 'paid' &&
    new Date(docData.due_date) < new Date();

  const hasLineItems = lineItems && lineItems.length > 0;
  const hasSections = sections && sections.length > 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ═══════════════════════════════════════════════
        DRAFT WATERMARK
        ═══════════════════════════════════════════════ */}
        {isDraft && (
          <View style={styles.draftWatermark} fixed>
            <Text style={styles.draftWatermarkText}>
              {isFr ? 'BROUILLON' : 'DRAFT'}
            </Text>
          </View>
        )}

        {/* ═══════════════════════════════════════════════
        LETTERHEAD
        ═══════════════════════════════════════════════ */}
        <View style={styles.letterhead}>
          <View style={styles.letterheadLeft}>
            {showLogo && (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={profile.logo_url} style={styles.logo} />
            )}
            <Text style={styles.businessName}>{profile.business_name}</Text>
          </View>

          <View style={styles.letterheadRight}>
            <Text
              style={[
                styles.documentTypeLabel,
                isDraft ? { color: '#92400e' } : {}
              ]}
            >
              {baseDocTitle}
            </Text>
            <Text style={styles.documentRef}>{docNumber}</Text>

            {/* Aligned Metadata Grid */}
            <View style={styles.metadataGrid}>
              <View style={styles.metadataRow}>
                <Text style={styles.metadataLabel}>
                  {lang?.invoiceDate || (isFr ? 'Date :' : 'Date:')}
                </Text>
                <Text style={styles.metadataValue}>{formattedInvoiceDate}</Text>
              </View>

              {!isCredit && formattedDueDate && (
                <View style={styles.metadataRow}>
                  <Text style={styles.metadataLabel}>
                    {lang?.dueDate || (isFr ? 'Échéance :' : 'Due:')}
                  </Text>
                  <Text
                    style={
                      isOverdue
                        ? styles.metadataValueOverdue
                        : styles.metadataValue
                    }
                  >
                    {formattedDueDate}
                  </Text>
                </View>
              )}

              {isCredit && docData?.relatedInvoiceNumber && (
                <View style={styles.metadataRow}>
                  <Text style={styles.metadataLabel}>
                    {isFr ? 'Facture :' : 'Invoice:'}
                  </Text>
                  <Text style={styles.metadataValue}>
                    {docData.relatedInvoiceNumber}
                  </Text>
                </View>
              )}
              {docData?.po_number && (
                <View style={styles.metadataRow}>
                  <Text style={styles.metadataLabel}>
                    {lang?.poNumber || 'PO Number:'}
                  </Text>
                  <Text style={styles.metadataValue}>{docData.po_number}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ═══════════════════════════════════════════════
        BILL TO
        ═══════════════════════════════════════════════ */}
        <View style={styles.billToSection}>
          <Text style={styles.sectionLabel}>
            {lang?.clientLabel || (isFr ? 'Client' : 'Client')}
          </Text>
          <Text style={styles.clientName}>{docData.client_name}</Text>
          {docData.client_address && (
            <Text style={styles.clientLine}>{docData.client_address}</Text>
          )}
          {docData.client_phone && (
            <Text style={styles.clientLine}>{docData.client_phone}</Text>
          )}
          {docData.client_email && (
            <Text style={styles.clientLine}>{docData.client_email}</Text>
          )}
        </View>

        {/* ═══════════════════════════════════════════════
        LINE ITEMS (for deposit/balance or custom invoices)
        ═══════════════════════════════════════════════ */}
        {hasLineItems && !hasSections && (
          <View style={styles.sectionSpacer}>
            <View style={styles.lineItemsHeader}>
              <Text style={[styles.lineItemHeaderCell, { flex: 1 }]}>
                {lang?.description || (isFr ? 'Description' : 'Description')}
              </Text>
              <Text
                style={[
                  styles.lineItemHeaderCell,
                  { width: 45, textAlign: 'center' }
                ]}
              >
                {lang?.qty || (isFr ? 'Qté' : 'Qty')}
              </Text>
              <Text
                style={[
                  styles.lineItemHeaderCell,
                  { width: 65, textAlign: 'right' }
                ]}
              >
                {lang?.unitPrice || (isFr ? 'Prix Unit.' : 'Unit Price')}
              </Text>
              <Text
                style={[
                  styles.lineItemHeaderCell,
                  { width: 45, textAlign: 'center' }
                ]}
              >
                {lang?.tax || (isFr ? 'TVA' : 'Tax')}
              </Text>
              <Text
                style={[
                  styles.lineItemHeaderCell,
                  { width: 75, textAlign: 'right' }
                ]}
              >
                {lang?.amount || (isFr ? 'Montant' : 'Amount')}
              </Text>
            </View>

            {lineItems.map((item, idx) => {
              const isLast = idx === lineItems.length - 1;
              return (
                <View
                  key={idx}
                  style={isLast ? styles.lineItemRowLast : styles.lineItemRow}
                  wrap={false}
                >
                  <Text style={styles.lineItemDescription}>
                    {item.description || (isFr ? 'Article' : 'Item')}
                  </Text>
                  <Text style={styles.lineItemQty}>{item.quantity}</Text>
                  <Text style={styles.lineItemUnitPrice}>
                    {formatCents(item.unit_price_cents)}
                  </Text>
                  <Text style={styles.lineItemTax}>
                    {item.tax_rate > 0 ? `${item.tax_rate}%` : '-'}
                  </Text>
                  <Text style={styles.lineItemAmount}>
                    {formatCents(item.amount_cents)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* ═══════════════════════════════════════════════
        SERVICES (for full invoices from estimates)
        ═══════════════════════════════════════════════ */}
        {hasSections && (
          <View style={styles.sectionSpacer}>
            <View style={styles.servicesHeader}>
              <Text style={styles.tableHeaderTextServices}>
                {lang?.serviceCategoryHeader ||
                  (isFr ? 'Catégorie' : 'Category')}
              </Text>
              <Text style={styles.tableHeaderTextServices}>
                {lang?.amountHeader || (isFr ? 'Montant' : 'Amount')}
              </Text>
            </View>

            {sections.map((sec, idx) => {
              const isLast = idx === sections.length - 1;
              return (
                <View
                  key={idx}
                  style={isLast ? styles.serviceRowLast : styles.serviceRow}
                  wrap={false}
                >
                  <View style={styles.serviceTopLine}>
                    <Text style={styles.serviceTitle}>
                      {sec.title || (isFr ? 'Prestation' : 'Service')}
                    </Text>
                    <Text style={styles.serviceAmount}>
                      {formatPrice(sec.total || 0)}
                    </Text>
                  </View>

                  <View style={styles.serviceContentBlock}>
                    {sec.description && (
                      <Text style={styles.serviceDescription}>
                        {sec.description}
                      </Text>
                    )}

                    {!sec.hasDetails && (sec.items || []).length > 0 && (
                      <View style={styles.itemsList}>
                        {sec.items.map((item, i) => {
                          const hasQtyInfo = item.qty > 0 || item.unit;
                          return (
                            <Text key={`item-${i}`} style={styles.itemLine}>
                              <Text style={styles.itemLineName}>
                                {item.name || (isFr ? 'Article' : 'Item')}
                              </Text>
                              {hasQtyInfo && (
                                <Text style={styles.itemLineMeta}>
                                  {' · '}
                                  {item.qty}
                                  {item.unit ? ` ${item.unit}` : ''}
                                </Text>
                              )}
                            </Text>
                          );
                        })}
                      </View>
                    )}

                    {sec.hasDetails && (
                      <View style={styles.detailsBlock}>
                        {sec.laborHours > 0 && (
                          <Text style={styles.detailLine}>
                            {isFr ? "Main-d'œuvre" : 'Labor'}: {sec.laborHours}
                            {sec.laborType === 'daily'
                              ? isFr
                                ? 'j'
                                : 'd'
                              : 'h'}{' '}
                            × {formatPrice(sec.laborRate)}
                            {sec.laborType === 'daily'
                              ? isFr
                                ? '/j'
                                : '/d'
                              : '/h'}{' '}
                            ({isFr ? 'TVA' : 'Tax'} {sec.laborTaxRate}%)
                          </Text>
                        )}
                        {(sec.items || []).map((item, i) => (
                          <Text key={`detail-${i}`} style={styles.detailLine}>
                            {item.name}: {item.qty}
                            {item.unit ? ` ${item.unit}` : ''} ×{' '}
                            {formatPrice(item.cost || 0)} (
                            {isFr ? 'TVA' : 'Tax'} {item.taxRate}%)
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ═══════════════════════════════════════════════
        ADDITIONAL CHARGES
        ═══════════════════════════════════════════════ */}
        {additionalCharges.length > 0 && (
          <View style={styles.sectionSpacer} wrap={false}>
            <View style={styles.chargesHeader}>
              <Text style={styles.tableHeaderTextCharges}>
                {lang?.additionalCharges ||
                  (isFr ? 'Frais Supplémentaires' : 'Additional Charges')}
              </Text>
              <Text style={styles.tableHeaderTextCharges}>
                {lang?.amountHeader || (isFr ? 'Montant' : 'Amount')}
              </Text>
            </View>

            {additionalCharges.map((charge, idx) => {
              const isLast = idx === additionalCharges.length - 1;
              let subtitle = '';
              if (charge.isPercentage) {
                subtitle = `${charge.percentageRate || 0}% · ${charge.basisLabel}`;
              } else {
                const qty = charge.qty || 1;
                const effectivePerUnitCents =
                  qty > 0 ? charge.amountCents / qty : 0;
                subtitle = `${qty} ${charge.unit} × ${formatCents(effectivePerUnitCents)}`;
              }

              return (
                <View
                  key={idx}
                  style={isLast ? styles.chargeRowLast : styles.chargeRow}
                  wrap={false}
                >
                  <View style={styles.chargeTopLine}>
                    <View style={styles.chargeInfoBlock}>
                      <Text style={styles.chargeName}>
                        {charge.name ||
                          (isFr ? 'Frais Supplémentaire' : 'Additional Charge')}
                      </Text>
                      <Text style={styles.chargeSubtitle}>{subtitle}</Text>
                    </View>
                    <Text style={styles.chargeAmount}>
                      {formatCents(charge.amountCents)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ═══════════════════════════════════════════════
        PAYMENT DETAILS (after totals, invoices only)
        ═══════════════════════════════════════════════ */}
        {!isCredit &&
          (profile.bank_name ||
            profile.bank_account_number ||
            profile.payment_link_url) && (
            <View style={{ marginTop: 18 }} wrap={false}>
              <Text
                style={[
                  styles.sectionLabel,
                  { marginBottom: 8, color: '#9ca3af' }
                ]}
              >
                {lang?.paymentInstructions ||
                  (isFr ? 'Instructions de paiement' : 'Payment Instructions')}
              </Text>
              {profile.bank_name && (
                <View
                  style={{
                    flexDirection: 'row',
                    marginBottom: 3,
                    alignItems: 'flex-start'
                  }}
                >
                  <Text
                    style={[
                      styles.footerText,
                      { width: 72, color: '#9ca3af', fontWeight: 'bold' }
                    ]}
                  >
                    {lang?.bankLabel || (isFr ? 'Banque' : 'Bank')}
                  </Text>
                  <Text
                    style={[
                      styles.footerText,
                      { flex: 1, color: '#374151', fontWeight: 'bold' }
                    ]}
                  >
                    {profile.bank_name}
                  </Text>
                </View>
              )}
              {profile.bank_account_number && (
                <View
                  style={{
                    flexDirection: 'row',
                    marginBottom: 3,
                    alignItems: 'flex-start'
                  }}
                >
                  <Text
                    style={[
                      styles.footerText,
                      { width: 72, color: '#9ca3af', fontWeight: 'bold' }
                    ]}
                  >
                    {lang?.bankAccountNumberLabel ||
                      (isFr ? 'IBAN' : 'Account')}
                  </Text>
                  <Text
                    style={[
                      styles.footerText,
                      { flex: 1, color: '#374151', fontFamily: 'Courier' }
                    ]}
                  >
                    {profile.bank_account_number}
                  </Text>
                </View>
              )}
              {profile.bank_routing_number && (
                <View
                  style={{
                    flexDirection: 'row',
                    marginBottom: 3,
                    alignItems: 'flex-start'
                  }}
                >
                  <Text
                    style={[
                      styles.footerText,
                      { width: 72, color: '#9ca3af', fontWeight: 'bold' }
                    ]}
                  >
                    {lang?.bicSwiftLabel || (isFr ? 'BIC/SWIFT' : 'Routing')}
                  </Text>
                  <Text
                    style={[
                      styles.footerText,
                      { flex: 1, color: '#374151', fontFamily: 'Courier' }
                    ]}
                  >
                    {profile.bank_routing_number}
                  </Text>
                </View>
              )}
              {profile.payment_link_url && (
                <View style={{ marginTop: 6 }}>
                  <Text style={[styles.footerText, { color: '#2563eb' }]}>
                    {lang?.paymentLinkLabel ||
                      (isFr ? 'Paiement en ligne' : 'Pay Online')}
                    {': '}
                    {profile.payment_link_url}
                  </Text>
                </View>
              )}
            </View>
          )}

        {/* ═══════════════════════════════════════════════
        REASON (Credit Notes) OR NOTES (Invoices)
        ═══════════════════════════════════════════════ */}
        {isCredit && docData.reason && (
          <View style={styles.textBlockRow} wrap={false}>
            <Text style={[styles.sectionLabel, { marginBottom: 8 }]}>
              {lang?.creditNoteReason || 'Reason'}
            </Text>
            <Text style={styles.textBlockDescription}>{docData.reason}</Text>
          </View>
        )}

        {/* ═══════════════════════════════════════════════
        TOTALS
        ═══════════════════════════════════════════════ */}
        <View style={styles.totalsContainer} wrap={false}>
          <View style={styles.totalsBox}>
            {/* Balance invoice: full project subtotal → deposit deduction → balance subtotal */}
            {!isCredit &&
              docData?.invoice_type === 'balance' &&
              fullProjectSubtotal > 0 && (
                <>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>
                      {lang?.approvedProjectSubtotal ||
                        (isFr
                          ? 'Sous-total projet approuvé'
                          : 'Approved project subtotal')}
                    </Text>
                    <Text style={styles.totalValue}>
                      {formatPrice(fullProjectSubtotal)}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.totalRow,
                      {
                        paddingBottom: 6,
                        marginBottom: 4,
                        borderBottomWidth: 0.5,
                        borderBottomColor: '#e5e7eb',
                        borderBottomStyle: 'dashed'
                      }
                    ]}
                  >
                    <View>
                      <Text style={styles.totalLabel}>
                        {isFr ? 'Moins : acompte versé' : 'Less: deposit paid'}
                      </Text>
                      {(depositRef || depositDate) && (
                        <Text
                          style={[
                            styles.totalLabel,
                            { fontSize: 7.5, marginTop: 1 }
                          ]}
                        >
                          {[depositRef, depositDate]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.totalValue}>
                      -{formatPrice(depositSubtotal)}
                    </Text>
                  </View>
                </>
              )}

            {/* Subtotal + tax — all invoices except credit notes (unless full credit) */}
            {(!isCredit || docData?.is_full_credit) && subtotal > 0 && (
              <>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>
                    {!isCredit && docData?.invoice_type === 'balance'
                      ? lang?.balanceSubtotal ||
                        (isFr ? 'Sous-total solde' : 'Balance subtotal')
                      : lang?.subtotalHT ||
                        (isFr ? 'Sous-total HT' : 'Subtotal')}
                  </Text>
                  <Text style={styles.totalValue}>{formatPrice(subtotal)}</Text>
                </View>

                {taxGroups.map(([rate, amt]) => (
                  <View key={rate} style={styles.totalRow}>
                    <Text style={styles.totalLabel}>
                      {lang?.tax || (isFr ? 'TVA' : 'Tax')} ({rate}%)
                    </Text>
                    <Text style={styles.totalValue}>{formatCents(amt)}</Text>
                  </View>
                ))}
              </>
            )}

            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>
                {lang?.grandTotalLabel || (isFr ? 'Total TTC' : 'Grand Total')}
              </Text>
              <Text style={[styles.grandTotalValue, { color: primaryColor }]}>
                {isCredit ? '-' : ''}
                {formatPrice(grandTotal)}
              </Text>
            </View>

            {/* Deposit breakdown pill (full invoices with deposit enabled) */}
            {!isCredit &&
              docData.deposit_enabled &&
              docData.invoice_type !== 'deposit' &&
              docData.invoice_type !== 'balance' && (
                <View style={styles.depositDivider}>
                  <View style={styles.depositRowPill}>
                    <Text style={styles.depositLabel}>
                      {lang?.depositLabel || (isFr ? 'Acompte' : 'Deposit')} (
                      {docData.deposit_percentage || 20}%)
                    </Text>
                    <Text style={styles.depositValue}>
                      {formatPrice(
                        (grandTotal * (docData.deposit_percentage || 20)) / 100
                      )}
                    </Text>
                  </View>
                  <View style={styles.balanceRow}>
                    <Text style={styles.balanceLabel}>
                      {lang?.balanceDue ||
                        (isFr ? 'Solde Restant' : 'Balance Due')}
                    </Text>
                    <Text style={styles.balanceValue}>
                      {formatPrice(
                        (grandTotal *
                          (100 - (docData.deposit_percentage || 20))) /
                          100
                      )}
                    </Text>
                  </View>
                </View>
              )}
          </View>
        </View>

        {/* ═══════════════════════════════════════════════
        FOOTER — Row 1: Compliance + Terms | Row 2: Business info centered
        ═══════════════════════════════════════════════ */}
        <View style={styles.footer} fixed>
          {/* Row 1: Compliance (left) + Payment terms (right) */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginBottom: 8
            }}
          >
            <View style={styles.footerBlock}>
              <Text style={styles.footerTitle}>
                {lang?.complianceLegal || (isFr ? 'Mentions Légales' : 'Legal')}
              </Text>
              <Text
                style={[styles.footerText, { marginTop: 4, fontSize: 7.5 }]}
              >
                {lang?.invoiceComplianceText ||
                  (isFr
                    ? "Document généré conformément à l'article 286 du code général des impôts."
                    : 'Certified digital invoice record.')}
              </Text>
            </View>

            <View style={[styles.footerBlock, { alignItems: 'flex-end' }]}>
              {!isCredit && (
                <>
                  <Text
                    style={[
                      styles.footerTitle,
                      { width: '100%', textAlign: 'right' }
                    ]}
                  >
                    {lang?.termsHeader ||
                      (isFr ? 'Conditions de Paiement' : 'Terms')}
                  </Text>
                  <Text
                    style={[
                      styles.footerText,
                      styles.footerTextRight,
                      { width: '100%', textAlign: 'right' }
                    ]}
                  >
                    {(() => {
                      if (docData.invoice_type === 'deposit') {
                        return isFr
                          ? 'Acompte payable dès réception.'
                          : 'Deposit due upon receipt.';
                      }
                      const rawTerms =
                        docData.payment_terms_snapshot ||
                        profile.payment_terms ||
                        '30_days';
                      const isUponReceipt = rawTerms === 'upon_receipt';
                      const days = isUponReceipt
                        ? 30
                        : parseInt(rawTerms.replace('_days', '')) || 30;
                      return isFr
                        ? `Règlement ${isUponReceipt ? 'dès réception.' : `sous ${days} jours.`}`
                        : `Payment due ${isUponReceipt ? 'upon receipt.' : `within ${days} days.`}`;
                    })()}
                  </Text>
                </>
              )}
            </View>
          </View>

          {/* Row 2: Business name + address + VAT — centered */}
          <View
            style={{
              width: '100%',
              borderTopWidth: 0.5,
              borderTopColor: '#f3f4f6',
              paddingTop: 6,
              alignItems: 'center'
            }}
          >
            <Text
              style={[
                styles.footerTitle,
                { textAlign: 'center', color: '#6b7280' }
              ]}
            >
              {profile.business_name}
            </Text>
            {profile.business_address && (
              <Text style={[styles.footerText, { textAlign: 'center' }]}>
                {profile.business_address}
              </Text>
            )}
            {(profile.business_zip || profile.business_city) && (
              <Text style={[styles.footerText, { textAlign: 'center' }]}>
                {isFr
                  ? `${profile.business_zip || ''} ${profile.business_city || ''}`.trim()
                  : `${profile.business_city || ''}${profile.business_state ? `, ${profile.business_state}` : ''} ${profile.business_zip || ''}`.trim()}
              </Text>
            )}
            {(profile.company_reg_number || profile.vat_number) && (
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'center',
                  marginTop: 3
                }}
              >
                {profile.company_reg_number && (
                  <Text
                    style={[
                      styles.footerText,
                      { textAlign: 'center', marginRight: 12 }
                    ]}
                  >
                    {lang?.companyRegNumber || (isFr ? 'SIRET' : 'Reg')}:{' '}
                    {profile.company_reg_number}
                  </Text>
                )}
                {profile.vat_number && (
                  <Text style={[styles.footerText, { textAlign: 'center' }]}>
                    {lang?.vatNumber || (isFr ? 'N° TVA' : 'VAT')}:{' '}
                    {profile.vat_number}
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>
      </Page>
    </Document>
  );
}
