import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export const dynamic = 'force-static';

export async function GET() {
  try {
    const specPath = join(process.cwd(), 'openapi.json');
    const spec = await readFile(specPath, 'utf-8');

    return new NextResponse(spec, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Failed to read openapi.json:', error);
    return NextResponse.json(
      { error: 'OpenAPI spec not found' },
      { status: 500 },
    );
  }
}
