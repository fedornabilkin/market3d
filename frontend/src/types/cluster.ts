export interface Cluster {
  id: number;
  userId: number;
  name: string;
  description?: string;
  regionId: number;
  cityId: number;
  metroId?: number;
  parentClusterId?: number;
  state: 'draft' | 'active' | 'inactive' | 'archived';
  createdAt: string;
  updatedAt: string;
  printersCount?: number;
  availablePrintersCount?: number;
  completedOrdersCount?: number;
  uniqueMaterials?: Array<{ id: number; name: string }>;
  uniqueColors?: Array<{ id: number; name: string }>;
  deliveryMethods?: Array<{ id: number; name: string; dictionaryId?: number }>;
  regionName?: string;
  cityName?: string;
  metroName?: string;
  parentClusterName?: string;
  userEmail?: string;
}

export interface ClusterPrinter {
  id: number;
  clusterId: number;
  printerId: number;
  addedBy: number;
  addedAt: string;
  printer?: {
    id: number;
    modelName: string;
    manufacturer: string;
    pricePerHour: number;
    state: string;
    userId: number;
  };
}

export interface ClusterPrinterRequest {
  id: number;
  clusterId: number;
  printerId: number;
  requestedBy: number;
  printerOwnerId: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  message?: string;
  createdAt: string;
  updatedAt: string;
  clusterName?: string;
  printerModelName?: string;
  printerManufacturer?: string;
  requestedByEmail?: string;
  printerOwnerEmail?: string;
}


