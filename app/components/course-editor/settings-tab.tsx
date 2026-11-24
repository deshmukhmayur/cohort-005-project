import { CourseStatus } from "~/db/schema";
import { Link, useFetcher } from "react-router";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Eye, Globe } from "lucide-react";
import { useFetcherToast } from "./use-fetcher-toast";

type SettingsCourse = {
  id: number;
  slug: string;
  status: string;
  price: number;
  pppEnabled: boolean;
};

export function SettingsTab({ course }: { course: SettingsCourse }) {
  return (
    <div className="space-y-6">
      <SettingsCard title="Course Status">
        <StatusField status={course.status} />
      </SettingsCard>
      <SettingsCard title="Pricing">
        <div className="space-y-4">
          <PriceField price={course.price} />
          <PppField enabled={course.pppEnabled} />
        </div>
      </SettingsCard>
      <SettingsCard title="Links">
        <Link to={`/courses/${course.slug}`}>
          <Button variant="outline" size="sm">
            <Eye className="mr-1.5 size-4" />
            View Public Page
          </Button>
        </Link>
      </SettingsCard>
    </div>
  );
}

function SettingsCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">{title}</h2>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function StatusField({ status }: { status: string }) {
  const fetcher = useFetcher();
  useFetcherToast(fetcher, "Course status updated.");

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">Status:</span>
      <Select
        value={status}
        onValueChange={(newStatus) =>
          fetcher.submit(
            { intent: "update-status", status: newStatus },
            { method: "post" }
          )
        }
      >
        <SelectTrigger className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={CourseStatus.Draft}>Draft</SelectItem>
          <SelectItem value={CourseStatus.Published}>Published</SelectItem>
          <SelectItem value={CourseStatus.Archived}>Archived</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function PriceField({ price }: { price: number }) {
  const fetcher = useFetcher();
  useFetcherToast(fetcher, "Price updated.");

  function handleBlur(event: React.FocusEvent<HTMLInputElement>) {
    const value = parseFloat(event.target.value);
    if (!isNaN(value) && value >= 0 && Math.round(value * 100) !== price) {
      fetcher.submit(
        { intent: "update-price", price: event.target.value },
        { method: "post" }
      );
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">Price:</span>
      <div className="flex items-center gap-1">
        <span className="text-sm text-muted-foreground">$</span>
        <Input
          type="number"
          min="0"
          max="9999.99"
          step="0.01"
          defaultValue={(price / 100).toFixed(2)}
          className="w-28"
          onBlur={handleBlur}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
      </div>
    </div>
  );
}

function PppField({ enabled }: { enabled: boolean }) {
  const fetcher = useFetcher();
  useFetcherToast(fetcher, "PPP setting updated.");

  return (
    <div
      className="flex items-center gap-2"
      title="Purchasing Power Parity: applies location-based discounts for students in lower-income countries"
    >
      <Globe className="size-4 text-muted-foreground" />
      <span className="text-sm font-medium">PPP:</span>
      <button
        type="button"
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          enabled ? "bg-primary" : "bg-muted"
        }`}
        onClick={() =>
          fetcher.submit(
            { intent: "update-ppp-enabled", pppEnabled: String(!enabled) },
            { method: "post" }
          )
        }
      >
        <span
          className={`inline-block size-4 transform rounded-full bg-white transition-transform ${
            enabled ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
      <span className="text-xs text-muted-foreground">
        {enabled ? "On" : "Off"}
      </span>
    </div>
  );
}
