import { NextResponse } from 'next/server';
import { getWebexTokens, getWebexCredentials } from '../../../../../lib/ssm';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const siteUrl = searchParams.get('siteUrl');

    if (!siteUrl) {
      return NextResponse.json({ hasCredentials: false });
    }

    const tokens = await getWebexTokens(siteUrl);
    const credentials = await getWebexCredentials(siteUrl);

    const hasCredentials = !!(
      tokens?.accessToken && 
      tokens?.refreshToken && 
      credentials?.clientId && 
      credentials?.clientSecret
    );

    return NextResponse.json({ hasCredentials });
  } catch (error) {
    return NextResponse.json({ hasCredentials: false }, { status: 500 });
  }
}
