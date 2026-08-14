import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    const body = await req.json();
    
    const updateData: any = {
      updatedAt: new Date()
    };

    if (typeof body.isActive === 'boolean') {
      updateData.isActive = body.isActive;
    }

    if (body.scheduledAt !== undefined) {
      updateData.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : new Date();
    }

    if (body.expiresAt !== undefined) {
      updateData.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    }

    if (body.title !== undefined) updateData.title = body.title.trim();
    if (body.message !== undefined) updateData.message = body.message.trim();
    if (body.type !== undefined) updateData.type = body.type;
    if (body.link !== undefined) updateData.link = body.link ? body.link.trim() : null;
    if (body.buttonText !== undefined) updateData.buttonText = body.buttonText ? body.buttonText.trim() : null;

    if (updateData.expiresAt && updateData.scheduledAt && updateData.expiresAt <= updateData.scheduledAt) {
      return NextResponse.json({ error: "Expiration date must be after scheduled start date" }, { status: 400 });
    }

    const announcement = await prisma.announcements.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json({ announcement });
  } catch (error) {
    console.error(`[PATCH /api/admin/announcements/${params.id}] Error:`, error);
    return NextResponse.json({ error: "Failed to update announcement" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    await prisma.announcements.delete({
      where: { id }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete announcement" }, { status: 500 });
  }
}
