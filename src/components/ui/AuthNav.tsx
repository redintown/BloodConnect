"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { logoutAction } from "@/app/(auth)/actions";

export function AuthNav() {
  const { user, loading } = useAuth();

  return (
    <div className="flex items-center justify-end gap-3 border-b border-gray-100 px-6 py-3 text-sm">
      {loading ? (
        <span className="text-gray-400">…</span>
      ) : user ? (
        <>
          <span className="max-w-[12rem] truncate text-gray-600">{user.email}</span>
          <form action={logoutAction}>
            <button type="submit" className="font-medium text-gray-700 hover:text-emergency">
              Log out
            </button>
          </form>
        </>
      ) : (
        <>
          <Link href="/login" className="text-gray-600 hover:text-gray-900">
            Log in
          </Link>
          <Link href="/register" className="font-medium text-emergency hover:text-emergency-hover">
            Register
          </Link>
        </>
      )}
    </div>
  );
}
