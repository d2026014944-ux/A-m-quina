import NeuralNetworkSection from "./NeuralNetworkSection";

export default function App() {
  const gold = "#F5C118";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#ececec",
        fontFamily: "Georgia, Times New Roman, serif",
        display: "flex",
        justifyContent: "center",
        padding: "26px 12px 36px",
      }}
    >
      <div style={{ width: 920, maxWidth: "100%" }}>
        <header style={{ marginBottom: 16 }}>
          <h1 style={{ margin: "0 0 10px", color: gold, fontSize: 31, fontWeight: 600 }}>
            MNHI 4.0 - Console de Respostas I/O
          </h1>
          <p style={{ margin: "0 0 6px", fontSize: 18, color: "#ddd", lineHeight: 1.55 }}>
            Esta interface representa a camada E1 com pipe HTTP/TCP real e saida adaptada para respostas I/O no
            frontend. O LSTM conecta-se diretamente ao acervo em livros-probabilidade-estatistica.md.
          </p>
          <p style={{ margin: 0, fontSize: 16, color: "#c7c7c7", lineHeight: 1.45 }}>
            Camada L8 integrada no navegador: ajuste de pesos sinapticos, frequencias binaurais em tempo real e
            visualizacao espectral com Web Audio API.
          </p>
        </header>

        <NeuralNetworkSection />
      </div>
    </div>
  );
}
