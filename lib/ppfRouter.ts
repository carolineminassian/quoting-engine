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
    const clientId = process.env.PPF_CLIENT_ID;
    const clientSecret = process.env.PPF_CLIENT_SECRET;
    const authUrl = process.env.PPF_AUTH_URL;
    const apiUrl = process.env.PPF_API_URL;

    // Secure verification guard to check for missing environment variables
    if (!clientId || !clientSecret || !authUrl || !apiUrl) {
      throw new Error(
        `Missing required PPF credentials inside server environment. Resolved: [Client ID: ${clientId ? 'Present' : 'MISSING'}, Secret: ${clientSecret ? 'Present' : 'MISSING'}, Auth URL: ${authUrl ? 'Present' : 'MISSING'}, API URL: ${apiUrl ? 'Present' : 'MISSING'}]`
      );
    }

    // 1. Authenticate with AIFE PISTE OAuth2 Gateway
    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString(
      'base64'
    );

    const tokenRes = await fetch(authUrl, {
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

    // 2. Base64 encode the uncompressed Factur-X PDF directly
    const base64Pdf = pdfBuffer.toString('base64');
    const safeFileName = `${invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`;

    // Assemble the clean single-document deposit schema for the G2B Sandbox
    // Note: 'idUtilisateurCourant' is set to a standard mock/sandbox identifier (0 or 12345) to link with PISTE developer context
    const payload = {
      idUtilisateurCourant: 0,
      fichierFacture: base64Pdf,
      nomFichier: safeFileName,
      formatDepot: 'PDF_NON_SIGNE'
    };

    // 3. Post to the official G2B single invoice submission endpoint
    // Logs are kept completely clean (no Base64 pollution)
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errDetails = await response.text();
      throw new Error(
        `PPF Submission failed (${response.status}): ${errDetails}`
      );
    }

    const result = (await response.json()) as {
      uidFlux?: string;
      numeroEnregistrement?: string;
      id?: string;
      statut?: string;
      pieceJointeId?: number;
      identifiantFacture?: string;
    };

    // Log clean, non-polluted success metadata to console
    console.log(
      `[PPF Sandbox] Successful submission receipt. Item ID: ${result.pieceJointeId || 'N/A'}`
    );

    return {
      success: true,
      ppfRegistryId: result.pieceJointeId
        ? String(result.pieceJointeId)
        : result.identifiantFacture || result.uidFlux || 'N/A',
      status: result.statut || 'INTERPRETEE_OCR'
    };
  } catch (err: any) {
    console.error('PPF Transmission Exception:', err);
    return {
      success: false,
      error: err.message || 'Transmission Exception'
    };
  }
}
