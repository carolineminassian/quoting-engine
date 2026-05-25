import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#111827'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20
  },
  text: {
    fontSize: 10,
    marginBottom: 8,
    color: '#4b5563'
  }
});

interface InvoicePDFProps {
  invoice: any;
  profile: any;
  lang: any;
  subtotal: number;
  taxGroups: [string, number][];
  grandTotal: number;
  sections: any[];
}

export default function InvoicePDF({
  invoice,
  profile,
  lang,
  grandTotal
}: InvoicePDFProps) {
  const isFr = profile.country === 'FR';
  const currencySymbol = profile.currency === 'EUR' ? '€' : '$';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>
          {isFr ? 'FACTURE' : 'INVOICE'} — {invoice.invoice_number}
        </Text>
        <Text style={styles.text}>{profile.business_name}</Text>
        <Text style={styles.text}>
          {isFr ? 'Client :' : 'Client:'} {invoice.client_name}
        </Text>
        <Text style={styles.text}>
          {isFr ? 'Total TTC :' : 'Grand Total:'} {currencySymbol}
          {grandTotal.toFixed(2)}
        </Text>
        <Text
          style={[
            styles.text,
            { marginTop: 20, color: '#9ca3af', fontSize: 8 }
          ]}
        >
          {isFr
            ? 'PDF complet disponible prochainement.'
            : 'Full PDF coming in next update.'}
        </Text>
      </Page>
    </Document>
  );
}
