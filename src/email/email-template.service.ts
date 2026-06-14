import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

// 1.- Renderiza plantillas HTML reemplazando {{variable}} y bloques {{#cond}}...{{/cond}}
@Injectable()
export class EmailTemplateService {
  private readonly templatesDir = path.join(__dirname, 'templates');

  renderizar(nombre: string, variables: Record<string, unknown>): string {
    const filePath = path.join(this.templatesDir, `${nombre}.html`);
    let html = fs.readFileSync(filePath, 'utf-8');

    // 2.- Bloques condicionales: {{#clave}}...{{/clave}} — se muestran si clave es truthy
    html = html.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, clave, contenido) => {
      const valor = variables[clave];
      if (!valor && valor !== 0) return '';
      // Si el valor es un array, renderiza el bloque por cada elemento
      if (Array.isArray(valor)) {
        return valor
          .map((item) => this.reemplazarVariables(contenido, item as Record<string, unknown>))
          .join('');
      }
      return this.reemplazarVariables(contenido, variables);
    });

    // 3.- Variables simples: {{variable}}
    html = this.reemplazarVariables(html, variables);

    return html;
  }

  private reemplazarVariables(texto: string, vars: Record<string, unknown>): string {
    return texto.replace(/\{\{(\w+)\}\}/g, (_, clave) => {
      const valor = vars[clave];
      return valor !== undefined && valor !== null ? String(valor) : '';
    });
  }
}
