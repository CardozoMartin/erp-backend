import { IsIn, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class AsignarPermisoDto {
  @IsUUID()
  @IsNotEmpty()
  permisoId!: string;

  @IsString()
  @IsIn(['grant', 'revoke'])
  tipo!: 'grant' | 'revoke';
}

export class RemoverPermisoDto {
  @IsUUID()
  @IsNotEmpty()
  permisoId!: string;
}
