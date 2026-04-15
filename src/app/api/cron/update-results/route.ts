import { NextResponse } from 'next/server';
import { syncFromNhl } from '@/lib/nhl-sync';

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const result = await syncFromNhl();
  return NextResponse.json(result);
}
