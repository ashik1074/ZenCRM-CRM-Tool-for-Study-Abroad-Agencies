"use client";
import { useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ClearFilters, DateRangeFilter, FilterBar, SearchFilter, SelectFilter } from "@/components/shared/list-filters";
import { SCHOLARSHIP_TYPES, STUDENT_STATUSES } from "@/lib/constants";

export function StudentFilters({
  counselors,
  intakes,
  sources,
  universities,
  canExport,
}: {
  counselors: { id: string; full_name: string }[];
  intakes: string[];
  sources: string[];
  universities: { id: string; name: string }[];
  canExport: boolean;
}) {
  const params = useSearchParams();
  const qs = params.toString();
  return (
    <FilterBar>
      <SearchFilter placeholder="Name, phone, email, passport…" />
      <SelectFilter param="status" label="Statuses" options={[...STUDENT_STATUSES, { value: "draft", label: "Drafts" }]} />
      <SelectFilter
        param="counselor"
        label="Counselors"
        options={[{ value: "me", label: "My students" }, { value: "none", label: "Unassigned" }, ...counselors.map((c) => ({ value: c.id, label: c.full_name }))]}
      />
      <SelectFilter param="intake" label="Intakes" options={intakes} width="w-full sm:w-40" />
      <SelectFilter param="university" label="Universities" options={universities.map((u) => ({ value: u.id, label: u.name }))} />
      <SelectFilter param="scholarship" label="Scholarships" options={SCHOLARSHIP_TYPES} width="w-full sm:w-40" />
      <SelectFilter param="source" label="Lead sources" options={sources} width="w-full sm:w-40" />
      <DateRangeFilter label="Created" />
      <ClearFilters />
      {canExport && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="sm:ml-auto"><Download /> Export</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild><a href={`/api/export/students?format=xlsx&${qs}`}>Excel (.xlsx)</a></DropdownMenuItem>
            <DropdownMenuItem asChild><a href={`/api/export/students?format=csv&${qs}`}>CSV</a></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </FilterBar>
  );
}
