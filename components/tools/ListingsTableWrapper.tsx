"use client";

import { ListingsTable } from "./ListingsTable";

interface Props {
  initialDistrict?: string;
}

export function ListingsTableWrapper({ initialDistrict }: Props) {
  return <ListingsTable initialDistrict={initialDistrict} />;
}
