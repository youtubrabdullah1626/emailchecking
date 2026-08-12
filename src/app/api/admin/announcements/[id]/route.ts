import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    const body = await req.json();
    
    // We only support toggling isActive or deleting for now in PATCH
    if (typeof body.isActive !== 'boolean') {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const announcement = await prisma.announcements.update({
      where: { id },
      data: {
        isActive: body.isActive,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({ announcement });
  } catch (error) {
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
