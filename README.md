# A-m-quina

Frontend React/Vite com pipeline textual (E1) e camada binaural (L8), revisado com o workflow
`akita-way-dynamic-systems` para garantir rastreabilidade matematica, TDD e isolamento de seguranca.

## Revisao Aplicada (Akita Way)

- Fundacao formal em `CLAUDE.MD` com hipoteses, objetivo e decisao de modelagem.
- Modelagem em estado (`state-space`) para duas saidas binaurais (L/R).
- Arquitetura separada entre planta e controlador:
  - `src/dynamics/plantModel.js`
  - `src/dynamics/controller.js`
  - `src/dynamics/closedLoop.js`
- Gate de integracao em malha fechada com teste obrigatorio de regressao de planta.

## Comandos

1. Instalar dependencias

	`npm install`

2. Rodar em desenvolvimento

	`npm run dev`

3. Executar testes (TDD e integracao de dinamica)

	`npm test`

4. Gerar build de producao

	`npm run build`

## Qualidade e Seguranca

- Nao implementar controlador sem testes previos.
- Nao executar scripts novos de simulacao/controle fora de ambiente isolado.
- Manter guardrails de runtime: timeout, maxIterations e limites de entrada.
- Tratar alteracoes na dinamica da planta como mudanca de contrato; se necessario, retunar o controlador.