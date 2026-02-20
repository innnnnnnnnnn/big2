import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import AppleProvider from "next-auth/providers/apple";
import LineProvider from "next-auth/providers/line";
import CredentialsProvider from "next-auth/providers/credentials";

console.log("NEXTAUTH_URL:", process.env.NEXTAUTH_URL);
console.log("LINE_ID:", process.env.LINE_CLIENT_ID);

const handler = NextAuth({
    providers: [
        CredentialsProvider({
            id: "guest",
            name: "Guest",
            credentials: {
                name: { label: "Name", type: "text", placeholder: "Guest Name" }
            },
            async authorize(credentials) {
                if (credentials?.name) {
                    return { id: "guest_" + Date.now(), name: credentials.name };
                }
                return null;
            }
        }),
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID || "123456789",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "static_secret",
        }),
        AppleProvider({
            clientId: process.env.APPLE_ID || "123456789",
            clientSecret: process.env.APPLE_SECRET || "static_secret",
        }),
        LineProvider({
            clientId: process.env.LINE_CLIENT_ID || "2009183123",
            clientSecret: process.env.LINE_CLIENT_SECRET || "2797c84317796be31a9eb4cd19bd9e35",
        }),
    ],
    secret: process.env.NEXTAUTH_SECRET || "shenmao_big_two_secret_key_2026",
    callbacks: {
        async jwt({ token, user, account }) {
            if (user) {
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as any).id = token.id;
            }
            console.log("Session updated:", session.user?.name, session.user?.email);
            return session;
        },
    },
    pages: {
        signIn: '/auth/signin',
    },
});

export { handler as GET, handler as POST };
