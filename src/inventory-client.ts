export interface InventoryClient {
  getBalance(skuId: string, locationId?: string): Promise<unknown>;
  searchCatalog(query: string): Promise<unknown>;
  adjust(body: {
    skuId: string;
    locationId: string;
    quantityDelta: number;
    reason: string;
    unitCostCents?: number | undefined;
  }): Promise<unknown>;
  transfer(body: {
    skuId: string;
    fromLocationId: string;
    toLocationId: string;
    quantity: number;
  }): Promise<unknown>;
  reorderRecommendations(): Promise<unknown>;
  createPurchaseOrder(body: unknown): Promise<unknown>;
  receiveShipment(body: unknown): Promise<unknown>;
  startCycleCount(body: unknown): Promise<unknown>;
  recordCount(body: unknown): Promise<unknown>;
}

export function createInventoryClient(env: Record<string, string | undefined>): InventoryClient {
  const baseUrl = env.KOALITY_INVENTORY_API_URL ?? "http://127.0.0.1:3000";
  const token = env.KOALITY_INVENTORY_TOKEN ?? "";

  async function request(path: string, init: RequestInit = {}): Promise<unknown> {
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${token}`);
    if (init.body) {
      headers.set("content-type", "application/json");
    }
    const response = await fetch(new URL(path, baseUrl), { ...init, headers });
    const text = await response.text();
    const payload: unknown = text ? JSON.parse(text) : {};
    if (!response.ok) {
      const message =
        typeof payload === "object" && payload && "error" in payload
          ? String((payload as { error: unknown }).error)
          : `Inventory API ${response.status}`;
      throw new Error(message);
    }
    return payload;
  }

  return {
    getBalance(skuId, locationId) {
      const params = new URLSearchParams({ skuId });
      if (locationId) {
        params.set("locationId", locationId);
      }
      return request(`/api/v1/stock/balances?${params.toString()}`);
    },
    searchCatalog(query) {
      return request(`/api/v1/items?q=${encodeURIComponent(query)}`);
    },
    adjust(body) {
      return request("/api/v1/stock/adjustments", { method: "POST", body: JSON.stringify(body) });
    },
    transfer(body) {
      return request("/api/v1/stock/transfers", { method: "POST", body: JSON.stringify(body) });
    },
    reorderRecommendations() {
      return request("/api/v1/procurement/reorder-recommendations");
    },
    createPurchaseOrder(body) {
      return request("/api/v1/procurement/purchase-orders", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    receiveShipment(body) {
      return request("/api/v1/procurement/receipts", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    startCycleCount(body) {
      return request("/api/v1/cycle-counts", { method: "POST", body: JSON.stringify(body) });
    },
    recordCount(body) {
      return request("/api/v1/cycle-counts/record", { method: "POST", body: JSON.stringify(body) });
    },
  };
}
