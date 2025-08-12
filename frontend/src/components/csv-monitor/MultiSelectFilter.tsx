"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MultiSelectFilterProps {
  label: string;
  options: { value: string | number; label: string }[];
  selectedValues: (string | number)[];
  onSelectionChange: (selected: (string | number)[]) => void;
  className?: string;
}

export function MultiSelectFilter({
  label,
  options,
  selectedValues,
  onSelectionChange,
  className,
}: MultiSelectFilterProps) {
  const handleSelect = (value: string | number) => {
    const newSelection = selectedValues.includes(value)
      ? selectedValues.filter((v) => v !== value)
      : [...selectedValues, value];
    onSelectionChange(newSelection);
  };

  const hasSelection = selectedValues.length > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "relative h-10 w-auto justify-start",
            hasSelection && "border-primary hover:border-primary/80",
            className
          )}
        >
          {label}
          {hasSelection && (
            <Badge variant="secondary" className="ml-2">
              {selectedValues.length}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={selectedValues.includes(option.value)}
            onSelect={(e) => {
              e.preventDefault();
              handleSelect(option.value);
            }}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
