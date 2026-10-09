import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> } // Ahora es una Promesa en Next.js 15
) {
  try {
    const { id: trackingId } = await params; // Desenvolvemos la promesa

    if (!trackingId) {
      return NextResponse.json({ error: 'Tracking ID is required' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { orderNumber: trackingId },
      include: {
        user: {
          select: {
            name: true,
            image: true,
          }
        }
      }
    });

    if (!order) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    return NextResponse.json(order);

  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json({ error: 'Error al buscar el pedido' }, { status: 500 });
  }
}
