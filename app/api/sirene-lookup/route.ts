import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.trim().length < 3) {
      return NextResponse.json({ results: [] });
    }

    // Official French State API for open business directory lookups
    const apiUrl = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(
      query
    )}&per_page=10`;

    const response = await fetch(apiUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'PactEstim SaaS Invoicing (support@pactestim.com)'
      }
    });

    if (!response.ok) {
      throw new Error(`Sirene API returned status ${response.status}`);
    }

    const data = await response.json();

    const results = (data.results || []).map((item: any) => {
      // Find the primary establishment address
      const address = item.adresse || '';
      const zip = item.code_postal || '';
      const city = item.libelle_commune || '';

      return {
        name: item.nom_complet || item.raison_sociale || '',
        siret: item.siege?.siret || '',
        siren: item.siren || '',
        address: address,
        zip: zip,
        city: city,
        country: 'FR'
      };
    });

    return NextResponse.json({ results });
  } catch (err: any) {
    console.error('Sirene Lookup API error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch business directory data' },
      { status: 500 }
    );
  }
}
