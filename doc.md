# Documentação das Funções

Este documento descreve as funções presentes no projeto, explicando seus propósitos e uso.

---

## Editor e Formatação de JSON

### formatJSON
- **Descrição:** Formata o conteúdo do editor no padrão JSON, com indentação de 2 espaços.  
- **Fluxo:**  
  - Verifica se o editor está vazio e alerta o usuário se necessário.  
  - Faz o parse do conteúdo JSON e, se válido, reapresenta o JSON formatado no editor.
- **Erros:** Exibe um alerta com a mensagem de erro se o JSON for inválido.

### clearEditor
- **Descrição:** Limpa o conteúdo do editor.  
- **Fluxo:**  
  - Recupera o conteúdo atual do editor.  
  - Se o conteúdo estiver vazio, alerta o usuário. Caso contrário, remove o conteúdo do editor.

### visualizeJSON
- **Descrição:** Converte o conteúdo JSON do editor em uma visualização gráfica.  
- **Fluxo:**  
  - Verifica se o editor possui conteúdo.  
  - Faz o parse do JSON.  
  - Chama a função `updateVisualization` para atualizar a visualização.
- **Erros:** Exibe um alerta caso o JSON seja inválido.

---

## Visualização do Diagrama

### updateVisualization
- **Descrição:** Atualiza a visualização com base nos dados JSON transformados.
- **Fluxo:**  
  - Limpa os elementos gráficos existentes (`<g>`).  
  - Converte os dados em uma hierarquia usando d3.hierarchy e configura um layout de árvore com `d3.tree()`.
  - Adiciona links e nós, aplicando escalas e transformações para renderizar os elementos.
  
### saveDiagram
- **Descrição:** Salva a visualização atual do diagrama como um arquivo SVG.
- **Fluxo:**  
  - Converte o SVG para string (`outerHTML`).
  - Cria um Blob com o conteúdo SVG.
  - Cria um link de download temporário para forçar o download do diagrama em formato `diagram.svg`.
  - Revoga a URL temporária após o download.

---

## Criação dos Nós e Formatação dos Dados

### createNodeContent
- **Descrição:** Gera o conteúdo HTML customizado para os nós do diagrama.
- **Fluxo:**  
  - Se o nó contém filhos (ou seja, representa um objeto ou array), exibe um cabeçalho com o nome e a contagem dos filhos.
  - Se o nó for uma propriedade com valor, exibe o nome da chave e o valor formatado de acordo com seu tipo, utilizando a função `formatValue`.

### formatValue
- **Descrição:** Formata o valor de acordo com o seu tipo.
- **Casos de uso:**
  - *string:* Envolve o valor entre aspas.
  - *boolean:* Exibe o valor em cor verde.
  - *number:* Aplica cor azul.
  - *null:* Retorna a string `null`.
  - Para outros casos, retorna o valor sem formatação especial.

### getValueClass
- **Descrição:** Retorna uma classe CSS baseada no tipo do valor para fins de estilização.
- **Casos de uso:**
  - `string` → `string-value`
  - `number` → `number-value`
  - `boolean` → `boolean-value`
  - Outros → `default-value`

### transformData
- **Descrição:** Transforma os dados JSON em uma estrutura hierárquica compatível com o D3 (raiz da árvore).
- **Fluxo:**  
  - Se o dado for `null`, retorna um objeto com o tipo "null".  
  - Se o dado for um objeto ou array, reconstrói a estrutura com uma propriedade `children` contendo as entradas do objeto/array.
  - Para outros tipos, retorna um objeto com os campos `name`, `type` e `value`.

---

## Tamanho dos Nós

### getNodeWidth
- **Descrição:** Calcula a largura de um nó, baseada no tamanho do texto (nome e valor).
- **Fluxo:**  
  - Usa o comprimento do conteúdo (nome + valor) e define um mínimo de 150 pixels.

### getNodeHeight
- **Descrição:** Retorna a altura de um nó fixo.
- **Valor:** Fixo em 40 pixels.

---

## Funções de Zoom e Ajuste da Visualização

### zoomIn
- **Descrição:** Aproxima (zoom in) a visualização.
- **Fluxo:** Transição suave aumentando a escala do zoom.

### zoomOut
- **Descrição:** Afasta (zoom out) a visualização.
- **Fluxo:** Aplica transição suave reduzindo a escala do zoom.

### resetZoom
- **Descrição:** Reseta a visualização para a escala original.
- **Fluxo:** Define a identidade da transformação de zoom.

### fitContent
- **Descrição:** Ajusta a visualização para que todo o conteúdo seja exibido no SVG.
- **Fluxo:**  
  - Calcula as dimensões do grupo de elementos (`<g>`) e as dimensões do contêiner SVG.  
  - Define a escala ideal para que o conteúdo se ajuste com margens, e centraliza o conteúdo no SVG.

---

## Funções do Modal de Boas-Vindas

### showWelcomePopup
- **Descrição:** Exibe o modal de boas-vindas ao usuário.
- **Fluxo:** Adiciona a classe `show` ao elemento do modal.

### closeWelcomePopup
- **Descrição:** Fecha o modal de boas-vindas.
- **Fluxo:** Remove a classe `show` do modal.

---

## Considerações Iniciais

- **Inicialização do Editor:**  
  O editor ACE é configurado com tema "monokai" e modo "json", junto com diversas opções personalizadas como tamanho da fonte, margem de impressão, etc.

- **Inicialização do SVG:**  
  O SVG é criado e configurado para ser responsivo, com suporte a zoom via d3.js.

- **Uso de D3.js:**  
  As visualizações utilizam os recursos do d3.js para gerar e manipular elementos gráficos baseados no conteúdo JSON.

Este documento serve como uma referência para entender a finalidade e a implementação das principais funções utilizadas no projeto.