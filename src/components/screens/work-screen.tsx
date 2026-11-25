"use client";

import React from "react";

import ItemGrid from "@/components/shared/item-grid";
import { WORK_ITEMS } from "@/constants/work";

export function WorkScreen({ active = true }: { active?: boolean }) {
  return <ItemGrid items={WORK_ITEMS} screenId="memoryWork" title="Work" active={active} />;
}
