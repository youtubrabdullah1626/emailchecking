export interface PaginationOptions { page?: number; limit?: number; }
export interface PaginatedResult<T> { data: T[]; pagination: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrevious: boolean; }; }
