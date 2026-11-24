import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { toast } from "sonner";
import { MonacoMarkdownEditor } from "~/components/monaco-markdown-editor";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Save } from "lucide-react";

export function SalesCopyTab({ course }: { course: { salesCopy: string } }) {
  const salesCopyFetcher = useFetcher();
  const [salesCopy, setSalesCopy] = useState<string>(course.salesCopy);
  const salesCopyHasChanges = salesCopy !== course.salesCopy;
  const salesCopyIsEmpty = salesCopy.trim().length === 0;

  useEffect(() => {
    if (salesCopyFetcher.state === "idle" && salesCopyFetcher.data?.success) {
      toast.success("Sales copy saved.");
    }
    if (salesCopyFetcher.state === "idle" && salesCopyFetcher.data?.error) {
      toast.error(salesCopyFetcher.data.error);
    }
  }, [salesCopyFetcher.state, salesCopyFetcher.data]);

  function handleSalesCopySave() {
    salesCopyFetcher.submit(
      { intent: "update-sales-copy", salesCopy },
      { method: "post" }
    );
  }

  return (
    <>
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
            onSave={handleSalesCopySave}
          />
          <div className="mt-4 flex items-center gap-4">
            <Button
              onClick={handleSalesCopySave}
              disabled={
                !salesCopyHasChanges ||
                salesCopyIsEmpty ||
                salesCopyFetcher.state !== "idle"
              }
            >
              <Save className="mr-1.5 size-4" />
              {salesCopyFetcher.state !== "idle"
                ? "Saving..."
                : "Save Sales Copy"}
            </Button>
            {salesCopyIsEmpty ? (
              <span className="text-sm text-destructive">
                Sales copy cannot be empty.
              </span>
            ) : (
              salesCopyHasChanges && (
                <span className="text-sm text-muted-foreground">
                  You have unsaved changes.
                </span>
              )
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
