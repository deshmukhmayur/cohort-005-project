import { useEffect } from "react";
import type { FetcherWithComponents } from "react-router";
import { toast } from "sonner";

export type ActionFetcher = FetcherWithComponents<{
  success?: boolean;
  error?: string;
}>;

export function useFetcherToast(
  fetcher: ActionFetcher,
  successMessage: string
) {
  useEffect(() => {
    if (fetcher.state !== "idle") return;
    if (fetcher.data?.success) toast.success(successMessage);
    if (fetcher.data?.error) toast.error(fetcher.data.error);
  }, [fetcher.state, fetcher.data, successMessage]);
}

export function useOnActionSuccess(
  fetcher: ActionFetcher,
  onSuccess: () => void
) {
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) onSuccess();
    // onSuccess only sets state; re-running it on each render would loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.state, fetcher.data]);
}
