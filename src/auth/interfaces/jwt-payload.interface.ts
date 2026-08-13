export interface JwtPayload {
  sub: string;
  email: string;
  sucursalId: string | null;
  permisos: string[];
}
