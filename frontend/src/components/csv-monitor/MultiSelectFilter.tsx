
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
import { ChevronDown } from "lucide-react";

interface Option {
  value: string | number;
  label: string;
  node?: React.ReactNode;
}

interface MultiSelectFilterProps {
  label: string;
  options: Option[];
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
            hasSelection && "border-foreground",
            className
          )}
        >
          {label}
          {hasSelection && (
            <Badge variant="secondary" className="ml-2">
              {selectedValues.length}
            </Badge>
          )}
          <ChevronDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
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
            {option.node || option.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

    