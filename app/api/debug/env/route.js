import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ENVIRONMENT: process.env.ENVIRONMENT,
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    AWS_REGION: process.env.AWS_REGION,
    AWS_DEFAULT_REGION: process.env.AWS_DEFAULT_REGION,
    allEnvKeys: Object.keys(process.env).filter(key => 
      key.includes('ENV') || key.includes('ENVIRONMENT') || key.includes('STAGE')
    )
  });
}