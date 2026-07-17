export async function transmitInvoiceToPPF({
  pdfBuffer,
  invoiceNumber,
  sellerSiren,
  buyerSiren
}: {
  pdfBuffer: Buffer;
  invoiceNumber: string;
  sellerSiren: string;
  buyerSiren: string;
}) {
  try {
    // 1. Authenticate with AIFE PISTE OAuth2 Gateway
    const authHeader = Buffer.from(
      `${process.env.PPF_CLIENT_ID}:${process.env.PPF_CLIENT_SECRET}`
    ).toString('base64');

    const tokenRes = await fetch(process.env.PPF_AUTH_URL!, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    if (!tokenRes.ok) {
      throw new Error(`PPF OAuth failed: ${tokenRes.statusText}`);
    }

    const tokenData = (await tokenRes.json()) as { access_token: string };
    const accessToken = tokenData.access_token;

    // 2. Build the multi-part form payload required by the PPF API
    const formData = new FormData();

    // Conforms to the standard French State Portals envelope schema
    const metadata = {
      emetteurSiren: sellerSiren,
      destinataireSiren: buyerSiren,
      numeroFacture: invoiceNumber,
      format: 'FACTUR_X',
      profil: 'BASIC'
    };

    // Safely append metadata as a File-like Blob to satisfy JSON Content-Type headers in web FormData
    const metadataBlob = new Blob([JSON.stringify(metadata)], {
      type: 'application/json'
    });
    formData.append('metadata', metadataBlob, 'metadata.json');

    // Convert Node.js Buffer explicitly to a Uint8Array and cast to any to eliminate the TypeScript ArrayBufferLike mismatch with standard Web BlobParts
    const uint8Array = new Uint8Array(
      pdfBuffer.buffer,
      pdfBuffer.byteOffset,
      pdfBuffer.byteLength
    );
    const pdfBlob = new Blob([uint8Array as any], { type: 'application/pdf' });

    // Attach the actual compiled Factur-X PDF
    formData.append('fichier', pdfBlob, `${invoiceNumber}.pdf`);

    // 3. Post to the official PPF Invoice Intake endpoint
    const response = await fetch(process.env.PPF_API_URL!, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      },
      body: formData
    });

    if (!response.ok) {
      const errDetails = await response.text();
      throw new Error(
        `PPF Submission failed (${response.status}): ${errDetails}`
      );
    }

    const result = (await response.json()) as {
      numeroEnregistrement?: string;
      id?: string;
      statut?: string;
    };
    return {
      success: true,
      ppfRegistryId: result.numeroEnregistrement || result.id || 'N/A', // State receipt reference
      status: result.statut || 'DEPOT_RECU'
    };
  } catch (err: any) {
    console.error('PPF Transmission Exception:', err);
    return {
      success: false,
      error: err.message || 'Transmission Exception'
    };
  }
}
