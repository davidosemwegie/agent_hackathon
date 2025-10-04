import { NextRequest, NextResponse } from "next/server";

// Email validation regex pattern
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Popular email providers to block
const POPULAR_EMAIL_PROVIDERS = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "protonmail.com",
  "tutanota.com",
  "yandex.com",
  "mail.ru",
  "zoho.com",
  "fastmail.com",
  "hey.com",
  "duck.com",
  "pm.me",
  "proton.me",
];

// Function to check if email is from a popular provider
function isPopularEmailProvider(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return POPULAR_EMAIL_PROVIDERS.includes(domain);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { firstName, lastName, email } = body;

    // Validate required fields
    if (!firstName || !lastName || !email) {
      const error = new Error(
        "Missing required fields: firstName, lastName, and email are required"
      );
      console.error("Validation error:", error.message);
      throw error;
    }

    // // Validate email format
    // if (!EMAIL_REGEX.test(email)) {
    //   const error = new Error("Email is invalid");
    //   console.error("Email validation error:", error.message, { email });
    //   throw error;
    // }

    // Check if email is from a popular provider (not a work email)
    if (isPopularEmailProvider(email)) {
      const error = new Error(
        "Please use your work email address. Personal email providers like Gmail, Yahoo, etc. are not allowed."
      );
      console.error("Email provider validation error:", error.message, {
        email,
      });
      throw error;
    }

    // If we reach here, email is valid
    return NextResponse.json(
      {
        success: true,
        message: "User updated successfully",
        data: {
          firstName,
          lastName,
          email,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in user update route:", error);

    // Re-throw the error so Datadog can capture it
    throw error;
  }
}
