import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const orders = await prisma.order.findMany({
      where: {
        user: {
          email: session.user.email
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        orderNumber: true,
        createdAt: true,
        total: true,
        currency: true,
        status: true
      }
    });

    return NextResponse.json(orders);

  } catch (error) {
    console.error('Error fetching user orders:', error);
    return NextResponse.json({ error: 'Error al obtener el historial' }, { status: 500 });
  }
}
