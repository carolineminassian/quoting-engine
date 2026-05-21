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

interface EstimatePDFProps {
  estimate: any;
  profile: any;
  lang: any;
  subtotal: number; // major units
  taxGroups: [string, number][]; // tax amounts in cents
  grandTotal: number; // major units
  sections: PreparedSection[];
  additionalCharges?: PreparedCharge[];
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 90,
    paddingHorizontal: 45,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#111827',
    backgroundColor: '#ffffff'
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
    alignItems: 'flex-end'
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
  documentDate: {
    fontSize: 9,
    color: '#6b7280',
    marginTop: 3
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

  // === SECTION HEADERS (Services + Additional Charges tables) ===
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
    borderBottomColor: '#e5e7eb'
  },
  tableHeaderText: {
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: 'bold'
  },
  tableHeaderTextLeft: {
    color: '#374151'
  },
  tableHeaderTextRight: {
    color: '#9ca3af'
  },

  // === SERVICE ROWS ===
  serviceRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6'
  },
  serviceRowLast: {
    paddingVertical: 10,
    borderBottomWidth: 0
  },
  serviceTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6
  },
  serviceTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827',
    flex: 1,
    paddingRight: 12
  },
  serviceAmount: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827'
  },
  serviceDescription: {
    fontSize: 9.5,
    color: '#4b5563',
    lineHeight: 1.5,
    marginBottom: 4
  },

  // Public materials list (when details OFF)
  itemsList: {
    marginTop: 4
  },
  itemBullet: {
    fontSize: 9,
    color: '#6b7280',
    marginBottom: 2,
    paddingLeft: 4
  },

  // Internal details breakdown (when details ON)
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
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 2
  },
  chargeAmount: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827'
  },
  chargeSubtitle: {
    fontSize: 8.5,
    color: '#6b7280',
    marginTop: 2
  },

  // === SECTION SPACING ===
  sectionSpacer: {
    marginBottom: 24
  },

  // === TOTALS ===
  totalsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 12,
    marginTop: 12,
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
    marginBottom: 8
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
    paddingTop: 12,
    marginTop: 6,
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
    fontWeight: 'bold',
    color: '#2563eb'
  },

  // === DEPOSIT BREAKDOWN ===
  depositDivider: {
    paddingTop: 10,
    marginTop: 12,
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
    bottom: 40,
    left: 50,
    right: 50,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  footerBlock: {
    width: '47%'
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

export default function EstimatePDF({
  estimate,
  profile,
  lang,
  subtotal,
  taxGroups,
  grandTotal,
  sections,
  additionalCharges = []
}: EstimatePDFProps) {
  const isFr = profile.country === 'FR';
  const currencySymbol = profile.currency === 'EUR' ? '€' : '$';
  const locale = isFr ? 'fr-FR' : 'en-US';

  // Format a number (in major units like dollars/euros) with proper thousands separators.
  // US: $1,234.56 · FR: €1 234,56 (non-breaking space + comma decimal)
  const formatPrice = (value: number): string => {
    const formatted = value.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return `${currencySymbol}${formatted}`;
  };

  // Same as formatPrice but accepts cents directly
  const formatCents = (cents: number): string => formatPrice(cents / 100);

  // Show logo only for Pro users with a logo URL
  const showLogo =
    profile.subscription_tier === 'pro' &&
    typeof profile.logo_url === 'string' &&
    profile.logo_url.length > 0;

  // Format date with full month name (matches on-screen design)
  const formattedDate = new Date(estimate.created_at).toLocaleDateString(
    locale,
    { year: 'numeric', month: 'long', day: 'numeric' }
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ═══════════════════════════════════════════════
          LETTERHEAD: business identity ←→ document metadata
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
            <Text style={styles.documentTypeLabel}>
              {isFr ? 'Devis' : 'Estimate'}
            </Text>
            <Text style={styles.documentRef}>
              #{estimate.custom_id || estimate.id.slice(0, 8)}
            </Text>
            <Text style={styles.documentDate}>{formattedDate}</Text>
          </View>
        </View>

        {/* ═══════════════════════════════════════════════
          BILL TO
          ═══════════════════════════════════════════════ */}
        <View style={styles.billToSection}>
          <Text style={styles.sectionLabel}>{isFr ? 'Client' : 'Client'}</Text>
          <Text style={styles.clientName}>{estimate.client_name}</Text>
          {estimate.client_address && (
            <Text style={styles.clientLine}>{estimate.client_address}</Text>
          )}
          {estimate.client_phone && (
            <Text style={styles.clientLine}>{estimate.client_phone}</Text>
          )}
          {estimate.client_email && (
            <Text style={styles.clientLine}>{estimate.client_email}</Text>
          )}
        </View>

        {/* ═══════════════════════════════════════════════
          SERVICES (heavy 3px black anchor)
          ═══════════════════════════════════════════════ */}
        <View style={styles.servicesHeader}>
          <Text style={[styles.tableHeaderText, styles.tableHeaderTextLeft]}>
            {isFr ? 'Etape du Service / Catégorie' : 'Service Category / Step'}
          </Text>
          <Text style={[styles.tableHeaderText, styles.tableHeaderTextRight]}>
            {isFr ? 'Montant' : 'Amount'}
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

              {/* Description */}
              {sec.description && (
                <Text style={styles.serviceDescription}>{sec.description}</Text>
              )}

              {/* Public items list (when internal details OFF) */}
              {!sec.hasDetails && (sec.items || []).length > 0 && (
                <View style={styles.itemsList}>
                  {sec.items.map((item, i) => (
                    <Text key={`item-${i}`} style={styles.itemBullet}>
                      · {item.name || (isFr ? 'Article' : 'Item')}
                      {item.qty > 0
                        ? ` (${item.qty}${item.unit ? ` ${item.unit}` : ''})`
                        : ''}
                    </Text>
                  ))}
                </View>
              )}

              {/* Internal details breakdown (when ON) — subtle inline list */}
              {sec.hasDetails && (
                <View style={styles.detailsBlock}>
                  {sec.laborHours > 0 && (
                    <Text style={styles.detailLine}>
                      {isFr ? "Main-d'œuvre" : 'Labor'}: {sec.laborHours}
                      {sec.laborType === 'daily'
                        ? isFr
                          ? 'j'
                          : 'd'
                        : 'h'} × {formatPrice(sec.laborRate)}
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
                      {formatPrice(item.cost || 0)} ({isFr ? 'TVA' : 'Tax'}{' '}
                      {item.taxRate}%)
                    </Text>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        {/* ═══════════════════════════════════════════════
          ADDITIONAL CHARGES (only if any) — light gray header
          ═══════════════════════════════════════════════ */}
        {additionalCharges.length > 0 && (
          <View style={styles.sectionSpacer} wrap={false}>
            <View style={[styles.chargesHeader, { marginTop: 24 }]}>
              <Text
                style={[styles.tableHeaderText, styles.tableHeaderTextLeft]}
              >
                {lang?.additionalCharges ||
                  (isFr ? 'Frais Supplémentaires' : 'Additional Charges')}
              </Text>
              <Text
                style={[styles.tableHeaderText, styles.tableHeaderTextRight]}
              >
                {isFr ? 'Montant' : 'Amount'}
              </Text>
            </View>

            {additionalCharges.map((charge, idx) => {
              const isLast = idx === additionalCharges.length - 1;

              // Subtitle: same logic as on-screen design
              let subtitle = '';
              if (charge.isPercentage) {
                subtitle = `${charge.percentageRate || 0}% · ${charge.basisLabel}`;
              } else {
                const qty = charge.qty || 1;
                // Compute effective per-unit cost (post-margin) by dividing back
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
          TOTALS — light hairline above, heavy black above grand total
          ═══════════════════════════════════════════════ */}
        <View style={styles.totalsContainer} wrap={false}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                {isFr ? 'Sous-total HT' : 'Subtotal'}
              </Text>
              <Text style={styles.totalValue}>{formatPrice(subtotal)}</Text>
            </View>

            {taxGroups.map(([rate, amt]) => (
              <View key={rate} style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  {isFr ? 'TVA' : 'Tax'} ({rate}%)
                </Text>
                <Text style={styles.totalValue}>{formatCents(amt)}</Text>
              </View>
            ))}

            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>
                {isFr ? 'Total TTC' : 'Grand Total'}
              </Text>
              <Text style={styles.grandTotalValue}>
                {formatPrice(grandTotal)}
              </Text>
            </View>

            {/* Deposit breakdown — blue pill + balance row */}
            {estimate.deposit_enabled && (
              <View style={styles.depositDivider}>
                <View style={styles.depositRowPill}>
                  <Text style={styles.depositLabel}>
                    {isFr
                      ? `Acompte (${estimate.deposit_percentage || 20}%)`
                      : `Deposit (${estimate.deposit_percentage || 20}%)`}
                  </Text>
                  <Text style={styles.depositValue}>
                    {formatPrice(
                      (grandTotal * (estimate.deposit_percentage || 20)) / 100
                    )}
                  </Text>
                </View>

                <View style={styles.balanceRow}>
                  <Text style={styles.balanceLabel}>
                    {isFr ? 'Solde Restant' : 'Balance Due'}
                  </Text>
                  <Text style={styles.balanceValue}>
                    {formatPrice(
                      (grandTotal *
                        (100 - (estimate.deposit_percentage || 20))) /
                        100
                    )}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* ═══════════════════════════════════════════════
          FOOTER (compliance + payment terms — preserved as-is)
          ═══════════════════════════════════════════════ */}
        <View style={styles.footer} fixed>
          <View style={styles.footerBlock}>
            <Text style={styles.footerTitle}>
              {isFr ? 'Conformité & Mentions Légales' : 'Compliance & Legal'}
            </Text>
            <Text style={styles.footerText}>
              {isFr
                ? "Document généré conformément à l'article 286 du code général des impôts (Loi Anti-Fraude TVA). Ce document est inaltérable une fois finalisé."
                : 'Standard business estimate. Certified digital record. Valid for 30 days from issuance.'}
            </Text>
          </View>
          <View
            style={[
              styles.footerBlock,
              { alignItems: 'flex-end', textAlign: 'right' }
            ]}
          >
            <Text
              style={[
                styles.footerTitle,
                { width: '100%', textAlign: 'right' }
              ]}
            >
              {isFr ? 'Conditions de Paiement' : 'Terms'}
            </Text>
            <Text
              style={[
                styles.footerText,
                styles.footerTextRight,
                { width: '100%' }
              ]}
            >
              {(() => {
                const rawTerms = estimate.payment_terms_snapshot || '30_days';
                const isUponReceipt = rawTerms === 'upon_receipt';
                const displayPaymentDays = isUponReceipt
                  ? 30
                  : parseInt(rawTerms.replace('_days', '')) || 30;

                if (isFr) {
                  if (estimate.deposit_enabled) {
                    return `Acompte de ${estimate.deposit_percentage || 0}% exigible à la signature pour le lancement du projet. Solde dû ${
                      isUponReceipt
                        ? 'dès réception.'
                        : `sous ${displayPaymentDays} jours.`
                    }`;
                  }
                  return `Règlement ${isUponReceipt ? 'dès réception.' : `sous ${displayPaymentDays} jours.`}`;
                } else {
                  if (estimate.deposit_enabled) {
                    return `Deposit of ${estimate.deposit_percentage || 0}% due upon acceptance to initiate work. Balance due ${
                      isUponReceipt
                        ? 'upon receipt.'
                        : `within ${displayPaymentDays} days.`
                    }`;
                  }
                  return `Payment due ${isUponReceipt ? 'upon receipt.' : `within ${displayPaymentDays} days.`}`;
                }
              })()}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
