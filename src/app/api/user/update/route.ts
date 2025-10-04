import { NextRequest, NextResponse } from 'next/server';

// Email validation regex pattern
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { firstName, lastName, email } = body;

    // Validate required fields
    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: firstName, lastName, and email are required' },
        { status: 400 }
      );
    }

    // Validate email format
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: 'Email is invalid' },
        { status: 400 }
      );
    }

    // If we reach here, email is valid
    return NextResponse.json(
      { 
        success: true, 
        message: 'User updated successfully',
        data: {
          firstName,
          lastName,
          email
        }
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error in user update route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
