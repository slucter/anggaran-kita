import { cookies } from 'next/headers';
import { db } from '@/db';
import { users, sessions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { SignJWT, jwtVerify } from 'jose';

const SECRET_KEY = process.env.SESSION_SECRET || 'fallback-secret-key-replace-in-prod';
const key = new TextEncoder().encode(SECRET_KEY);

export async function encrypt(payload: any) {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('30d')
        .sign(key);
}

export async function decrypt(input: string): Promise<any> {
    const { payload } = await jwtVerify(input, key, {
        algorithms: ['HS256'],
    });
    return payload;
}

export async function getSession() {
    const sessionToken = (await cookies()).get('session')?.value;
    if (!sessionToken) return null;
    try {
        const payload = await decrypt(sessionToken);
        return payload;
    } catch (e) {
        return null;
    }
}

export async function getCurrentUser() {
    const session = await getSession();
    if (!session || !session.userId) return null;

    const user = await db.query.users.findFirst({
        where: eq(users.id, session.userId),
    });

    return user;
}
