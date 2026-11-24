import { useState } from "react";
import { useFetcher } from "react-router";
import { MonacoMarkdownEditor } from "~/components/monaco-markdown-editor";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Save } from "lucide-react";
import { useFetcherToast } from "./use-fetcher-toast";

export function SalesCopyTab({ course }: { course: { salesCopy: string } }) {
  const fetcher = useFetcher();
  const [salesCopy, setSalesCopy] = useState<string>(course.salesCopy);
  const hasChanges = salesCopy !== course.salesCopy;
  const isEmpty = salesCopy.trim().length === 0;
  const isSaving = fetcher.state !== "idle";
  useFetcherToast(fetcher, "Sales copy saved.");

  function handleSave() {
    fetcher.submit(
      { intent: "update-sales-copy", salesCopy },
      { method: "post" }
    );
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">Sales Copy</h2>
        <p className="text-sm text-muted-foreground">
          Write the course sales copy in Markdown. This is shown on the public
          course page. Press Ctrl+S to format and save.
        </p>
      </CardHeader>
      <CardContent>
        <MonacoMarkdownEditor
          value={salesCopy}
          onChange={setSalesCopy}
          onSave={handleSave}
        />
        <div className="mt-4 flex items-center gap-4">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isEmpty || isSaving}
          >
            <Save className="mr-1.5 size-4" />
            {isSaving ? "Saving..." : "Save Sales Copy"}
          </Button>
          <SalesCopyHint isEmpty={isEmpty} hasChanges={hasChanges} />
        </div>
      </CardContent>
    </Card>
  );
}

function SalesCopyHint({
  isEmpty,
  hasChanges,
}: {
  isEmpty: boolean;
  hasChanges: boolean;
}) {
  if (isEmpty) {
    return (
      <span className="text-sm text-destructive">
        Sales copy cannot be empty.
      </span>
    );
  }
  if (!hasChanges) return null;
  return (
    <span className="text-sm text-muted-foreground">
      You have unsaved changes.
    </span>
  );
}
