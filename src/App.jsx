import { useState, useRef, useEffect } from "react";
import "./App.css";

function App() {
  const [codigo, setCodigo] = useState("");
  const [produto, setProduto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [precoCustom, setPrecoCustom] = useState("");
  const [produtosSalvos, setProdutosSalvos] = useState([]);
  const [nomeTemp, setNomeTemp] = useState("");
  const [marcaTemp, setMarcaTemp] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current.focus();
    carregarProdutosSalvos();
  }, []);

  const carregarProdutosSalvos = () => {
    const dados = JSON.parse(localStorage.getItem("produtos_modificados") || "[]");
    setProdutosSalvos(dados);
  };

  const salvarProdutosLocal = (lista) => {
    localStorage.setItem("produtos_modificados", JSON.stringify(lista));
    setProdutosSalvos(lista);
  };

  // 🔹 Traduz texto automaticamente com LibreTranslate
  const traduzirTexto = async (texto) => {
    if (!texto) return texto;
    try {
      const res = await fetch("https://libretranslate.de/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: texto,
          source: "auto",
          target: "pt",
          format: "text",
        }),
      });
      const data = await res.json();
      return data?.translatedText || texto;
    } catch {
      return texto; 
    }
  };

  // 🔹 Função principal de busca (com múltiplas APIs + tradução)
  const buscarProduto = async () => {
    if (!codigo) return alert("Digite ou escaneie um código de barras!");

    setLoading(true);
    setProduto(null);

    try {
      let nome = "";
      let marca = "";
      let descricao = "";
      let imagem = "";

      // === 1️⃣ OpenFoodFacts ===
      try {
        const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${codigo}.json`);
        const data = await res.json();
        if (data.status === 1) {
          const p = data.product;
          nome = p.product_name || p.generic_name || "";
          marca = p.brands || "";
          descricao = p.categories || "Sem descrição";
          imagem = p.image_url || "";
        }
      } catch (err) {
        console.warn("OpenFoodFacts falhou:", err);
      }

      // === 2️⃣ BrasilAPI ===
      if (!nome || !marca) {
        try {
          const res2 = await fetch(`https://brasilapi.com.br/api/barcode/v1/${codigo}`);
          if (res2.ok) {
            const data2 = await res2.json();
            if (data2?.description) nome = nome || data2.description;
            if (data2?.brand) marca = marca || data2.brand;
          }
        } catch (err) {
          console.warn("BrasilAPI falhou:", err);
        }
      }

      // === 3️⃣ UPCItemDB ===
      if (!nome || !marca) {
        try {
          const res3 = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${codigo}`);
          const data3 = await res3.json();
          if (data3?.items && data3.items.length > 0) {
            const p = data3.items[0];
            nome = nome || p.title;
            marca = marca || p.brand;
            imagem = imagem || p.images?.[0] || "";
            descricao = descricao || p.description || "Sem descrição";
          }
        } catch (err) {
          console.warn("UPCItemDB falhou:", err);
        }
      }

      // === 4️⃣ ProductOpenData ===
      if (!nome || !marca) {
        try {
          const res4 = await fetch(`https://api.productopendata.com/products/${codigo}`);
          const data4 = await res4.json();
          if (data4?.product) {
            nome = nome || data4.product.name;
            marca = marca || data4.product.brand;
            imagem = imagem || data4.product.image_url;
          }
        } catch (err) {
          console.warn("ProductOpenData falhou:", err);
        }
      }

      // 🔹 Tradução automática (nome e marca)
      nome = await traduzirTexto(nome);
      marca = await traduzirTexto(marca);

      // 🔹 Se nenhuma API achou
      nome = nome || `Produto ${codigo.slice(-4)}`;
      marca = marca || "Marca Genérica";
      descricao = descricao || "Sem descrição disponível";

      // Verifica se já existe salvo localmente
      const lista = JSON.parse(localStorage.getItem("produtos_modificados") || "[]");
      const produtoExistente = lista.find((item) => item.codigo === codigo);

      setProduto({
        codigo,
        nome,
        marca,
        descricao,
        preco: produtoExistente?.preco || "Sem preço definido",
        imagem: produtoExistente?.imagem || imagem,
      });

      setNomeTemp("");
      setMarcaTemp("");
    } catch (err) {
      alert("Erro ao buscar produto.");
      console.error(err);
    } finally {
      setLoading(false);
      setCodigo("");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") buscarProduto();
  };

  // 🔹 Upload manual de imagem
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result;
      setProduto((prev) => ({ ...prev, imagem: base64 }));
    };
    reader.readAsDataURL(file);
  };

  // 🔹 Confirmar nome e marca manualmente
  const confirmarNomeMarca = (tipo) => {
    if (!produto) return;
    if (tipo === "nome" && nomeTemp.trim()) {
      setProduto({ ...produto, nome: nomeTemp.trim() });
      setNomeTemp("");
    }
    if (tipo === "marca" && marcaTemp.trim()) {
      setProduto({ ...produto, marca: marcaTemp.trim() });
      setMarcaTemp("");
    }
  };

  // 🔹 Salvar produto com preço formatado
  const salvarProdutoAtualizado = () => {
    if (!produto) return alert("Nenhum produto carregado.");
    if (!precoCustom && produto.preco === "Sem preço definido")
      return alert("Digite um preço antes de salvar!");

    const precoFormatado = precoCustom
      ? `${precoCustom}R$`
      : produto.preco;

    const novosProdutos = [...produtosSalvos];
    const index = novosProdutos.findIndex((p) => p.codigo === produto.codigo);

    const atualizado = {
      ...produto,
      preco: precoFormatado,
    };

    if (index >= 0) novosProdutos[index] = atualizado;
    else novosProdutos.push(atualizado);

    salvarProdutosLocal(novosProdutos);
    setProduto(atualizado);
    setPrecoCustom("");
    alert("Produto salvo com sucesso!");
  };

  // 🔹 Formata preço (aceita apenas números)
  const handlePrecoChange = (e) => {
    let valor = e.target.value.replace(/\D/g, ""); 
    if (valor.length > 2) valor = valor.slice(0, -2) + "," + valor.slice(-2);
    setPrecoCustom(valor);
  };

  const gerarArquivoJSON = () => {
    const produtosFormatados = produtosSalvos.map((p) => ({
      ...p,
      preco: p.preco.endsWith("R$") ? p.preco : `${p.preco}R$`,
    }));

    const dataStr = JSON.stringify(produtosFormatados, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "produtos_modificados.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container">
      <h1>ConsulteJá</h1>
      <p>Escaneie o código de barras ou digite manualmente:</p>

      <div className="input-area">
        <input
          ref={inputRef}
          type="text"
          placeholder="Escaneie ou digite o código"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          onKeyDown={handleKeyPress}
        />
        <button onClick={buscarProduto}>Consultar</button>
      </div>

      {loading && <p className="loading">Carregando...</p>}

      {produto && (
        <div className="card">
          <div className="campo-editavel">
            <strong>Nome:</strong>{" "}
            {produto.nome.startsWith("Produto ") ? (
              <div className="edit-area">
                <input
                  type="text"
                  value={nomeTemp}
                  placeholder="Digite o nome do produto"
                  onChange={(e) => setNomeTemp(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && confirmarNomeMarca("nome")}
                />
                <button onClick={() => confirmarNomeMarca("nome")}>Confirmar</button>
              </div>
            ) : (
              <span>{produto.nome}</span>
            )}
          </div>

          <div className="campo-editavel">
            <strong>Marca:</strong>{" "}
            {produto.marca === "Marca Genérica" ? (
              <div className="edit-area">
                <input
                  type="text"
                  value={marcaTemp}
                  placeholder="Digite a marca"
                  onChange={(e) => setMarcaTemp(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && confirmarNomeMarca("marca")}
                />
                <button onClick={() => confirmarNomeMarca("marca")}>Confirmar</button>
              </div>
            ) : (
              <span>{produto.marca}</span>
            )}
          </div>

          <pre className="descricao"><strong>Descrição:</strong> {produto.descricao}</pre>
          <p className="preco"><strong>Preço:</strong> {produto.preco}</p>

          {produto.imagem ? (
            <div className="imagem-produto">
              <img src={produto.imagem} alt={produto.nome} className="produto-img" />
              <div className="botoes-imagem">
                <label className="btn-alterar">
                  Alterar imagem
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleImageUpload}
                  />
                </label>
                <button
                  className="btn-remover"
                  onClick={() => setProduto({ ...produto, imagem: "" })}
                >
                  Remover
                </button>
              </div>
            </div>
          ) : (
            <div className="upload-imagem">
              <p>Nenhuma imagem disponível. Adicione uma:</p>
              <input type="file" accept="image/*" onChange={handleImageUpload} />
            </div>
          )}

          <div className="preco-custom">
            <input
              type="text"
              placeholder="Digite o preço (ex: 1000 = 10,00R$)"
              value={precoCustom}
              onChange={handlePrecoChange}
            />
            <button onClick={salvarProdutoAtualizado}>Salvar Produto</button>
          </div>
        </div>
      )}

      {produtosSalvos.length > 0 && (
        <div className="lista">
          <h3>Produtos com preços personalizados</h3>
          <ul>
            {produtosSalvos.map((p) => (
              <li key={p.codigo}>
                <strong>{p.nome}</strong> — {p.preco}
              </li>
            ))}
          </ul>
          <button onClick={gerarArquivoJSON}>Gerar API JSON</button>
        </div>
      )}
    </div>
  );
}

export default App;
