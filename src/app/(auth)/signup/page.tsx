import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Criar conta — Finanças+" };

export default function SignupPage() {
  return <SignupForm />;
}
