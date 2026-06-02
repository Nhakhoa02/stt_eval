import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { passcode } = await request.json();
    const adminSecret = process.env.ADMIN_SECRET || 'admin123';

    if (passcode === adminSecret) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { success: false, error: 'Mã xác thực Admin không chính xác.' },
        { status: 401 }
      );
    }
  } catch (err) {
    console.error('Admin login error:', err);
    return NextResponse.json(
      { error: 'Hệ thống gặp lỗi trong quá trình xử lý đăng nhập.' },
      { status: 500 }
    );
  }
}
