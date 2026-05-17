import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font
} from '@react-pdf/renderer';

// Enregistrement d'une police standard propre
StyleSheet.create({});

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#111827',
    backgroundColor: '#ffffff'
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
    alignItems: 'start'
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: -1,
    color: '#111827',
    marginBottom: 15
  },
  businessName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2563eb',
    textTransform: 'uppercase',
    textAlign: 'right',
    marginBottom: 5
  },
  metaText: {
    fontSize: 9,
    color: '#6b7280',
    textAlign: 'right',
    marginBottom: 2
  },
  label: {
    fontSize: 8,
    textTransform: 'uppercase',
    color: '#9ca3af',
    fontWeight: 'bold',
    marginBottom: 3
  },
  clientName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937'
  },
  clientAddress: {
    fontSize: 10,
    color: '#4b5563',
    marginTop: 2,
    maxWidth: 220,
    lineHeight: 1.4
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 3,
    borderBottomColor: '#111827',
    paddingBottom: 6,
    textTransform: 'uppercase',
    fontSize: 8,
    fontWeight: 'bold',
    color: '#9ca3af',
    letterSpacing: 1
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingVertical: 14,
    alignItems: 'start'
  },
  colDescription: {
    width: '75%',
    paddingRight: 15
  },
  colAmount: {
    width: '24%',
    textAlign: 'right',
    fontSize: 12,
    fontWeight: 'bold',
    color: '#374151'
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4
  },
  sectionText: {
    fontSize: 9,
    color: '#6b7280',
    lineHeight: 1.4,
    marginBottom: 6
  },
  breakdownBox: {
    backgroundColor: '#f9fafb',
    padding: 6,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#f3f4f6'
  },
  breakdownLine: {
    fontSize: 8,
    color: '#4b5563',
    marginBottom: 2
  },
  totalsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20
  },
  totalsBox: {
    width: 240
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  totalLabel: {
    fontSize: 8,
    textTransform: 'uppercase',
    color: '#9ca3af',
    fontWeight: 'bold'
  },
  totalValue: {
    fontSize: 10,
    color: '#4b5563'
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 3,
    borderTopColor: '#111827',
    paddingTop: 8,
    marginTop: 6,
    alignItems: 'baseline'
  },
  grandTotalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase'
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2563eb'
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 15,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  footerBlock: {
    width: '45%'
  },
  footerTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: '#9ca3af',
    marginBottom: 4
  },
  footerText: {
    fontSize: 8,
    color: '#9ca3af',
    lineHeight: 1.4,
    fontStyle: 'italic'
  }
});

interface EstimatePDFProps {
  estimate: any;
  profile: any;
  lang: any;
  subtotal: number;
  taxGroups: [string, number][];
  grandTotal: number;
  sections: any[];
}

export default function EstimatePDF({
  estimate,
  profile,
  lang,
  subtotal,
  taxGroups,
  grandTotal,
  sections
}: EstimatePDFProps) {
  const isFr = profile.country === 'FR';
  const currencySymbol = profile.currency === 'EUR' ? '€' : '$';

  const formatPrice = (value: number) => {
    const formatted = value.toFixed(2);
    return profile.currency === 'EUR'
      ? `${formatted.replace('.', ',')}${currencySymbol}`
      : `${currencySymbol}${formatted}`;
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* En-tête */}
        <View style={styles.headerContainer}>
          <View>
            <Text style={styles.title}>{isFr ? 'Devis' : 'Estimate'}</Text>
            <Text style={styles.label}>{isFr ? 'Client' : 'Client'}</Text>
            <Text style={styles.clientName}>{estimate.client_name}</Text>
            {estimate.client_address && (
              <Text style={styles.clientAddress}>
                {estimate.client_address}
              </Text>
            )}
            {estimate.client_phone && (
              <Text style={styles.metaText}>{estimate.client_phone}</Text>
            )}
            {estimate.client_email && (
              <Text style={styles.metaText}>{estimate.client_email}</Text>
            )}
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.businessName}>{profile.business_name}</Text>
            <Text style={styles.metaText}>
              {isFr ? 'Date :' : 'Date:'}{' '}
              {new Date(estimate.created_at).toLocaleDateString(
                isFr ? 'fr-FR' : 'en-US'
              )}
            </Text>
            <Text style={styles.metaText}>
              {isFr ? 'Réf :' : 'Ref:'}{' '}
              {estimate.custom_id || estimate.id.slice(0, 8)}
            </Text>
          </View>
        </View>

        {/* Tableau des prestations */}
        <View style={styles.tableHeader}>
          <Text style={{ width: '75%' }}>
            {isFr ? 'Etape du Service / Catégorie' : 'Service Category / Step'}
          </Text>
          <Text style={{ width: '25%', textAlign: 'right' }}>
            {isFr ? 'Montant' : 'Amount'}
          </Text>
        </View>

        {/* Lignes du devis */}
        {sections.map((sec, idx) => (
          <View key={idx} style={styles.row} wrap={false}>
            <View style={styles.colDescription}>
              <Text style={styles.sectionTitle}>{sec.title}</Text>
              <Text style={styles.sectionText}>{sec.description}</Text>

              {/* Détails internes optionnels du snapshot */}
              {sec.hasDetails && (
                <View style={styles.breakdownBox}>
                  {sec.laborHours > 0 && (
                    <Text style={styles.breakdownLine}>
                      • {isFr ? "Main-d'œuvre" : 'Labor'}: {sec.laborHours}
                      {sec.laborType === 'daily'
                        ? isFr
                          ? 'j'
                          : 'd'
                        : 'h'} @ {formatPrice(sec.laborRate)}
                      {sec.laborType === 'daily'
                        ? isFr
                          ? '/j'
                          : '/d'
                        : '/h'}{' '}
                      (Tax: {sec.laborTaxRate}%)
                    </Text>
                  )}
                  {sec.items.map((item: any, i: number) => (
                    <Text key={i} style={styles.breakdownLine}>
                      • {item.name} : {item.qty} {item.unit} @{' '}
                      {formatPrice(item.cost)} (Tax: {item.taxRate}%)
                    </Text>
                  ))}
                </View>
              )}
            </View>
            <Text style={styles.colAmount}>{formatPrice(sec.total)}</Text>
          </View>
        ))}

        {/* Calculs des totaux financiers */}
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
                <Text style={styles.totalValue}>{formatPrice(amt / 100)}</Text>
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
          </View>
        </View>

        {/* Mentions légales bas de page */}
        <View style={styles.footer} wrap={false}>
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
          <View style={[styles.footerBlock, { alignItems: 'flex-end' }]}>
            <Text style={styles.footerTitle}>
              {isFr ? 'Conditions de Paiement' : 'Terms'}
            </Text>
            <Text style={[styles.footerText, { fontWeight: 'bold' }]}>
              {isFr ? 'Règlement sous 30 jours.' : 'Payment due upon receipt.'}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
