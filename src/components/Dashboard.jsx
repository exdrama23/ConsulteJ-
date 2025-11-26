import { useState, useMemo, useRef, useEffect } from 'react';
import {
    Search,
    Package,
    History,
    BarChart3,
    Upload,
    Download,
    ArrowUpDown,
    Calendar,
    DollarSign,
    Hash,
    Link,
    Copy,
    Printer,
    X,
    QrCode
} from 'lucide-react';
import ProductCard from './ProductCard';
import StatsCard from './StatsCard';
import HistoryList from './HistoryList';
import UploadConverter from './UploadConverter';
import SearchSection from './SearchSection';

const Dashboard = ({
    codigo,
    setCodigo,
    produto,
    loading,
    precoCustom,
    nomeTemp,
    setNomeTemp,
    marcaTemp,
    setMarcaTemp,
    descricaoTemp,
    setDescricaoTemp,
    editandoNome,
    editandoMarca,
    editandoDescricao,
    inputRef,
    onBuscarProduto,
    onKeyPress,
    onImageUpload,
    onRemoverImagem,
    onIniciarEdicaoNome,
    onIniciarEdicaoMarca,
    onIniciarEdicaoDescricao,
    onConfirmarEdicao,
    onCancelarEdicao,
    onSalvarProduto,
    onPrecoChange,

    
    produtosSalvos,
    historicoPesquisas,
    onGerarArquivoJSON,
    onSalvarProdutosLocal,
    onGerarLinkAPI,
    onExcluirProduto,
    apiLink,
    alertMessage
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('nome');
    const [sortOrder, setSortOrder] = useState('asc');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(8);

    
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [currentPrintModal, setCurrentPrintModal] = useState(1);
    const [selectedFormat, setSelectedFormat] = useState('');
    const [selectedInfo, setSelectedInfo] = useState({
        codigo: true,
        nome: true,
        marca: true,
        descricao: true,
        preco: true,
        imagem: true
    });

    
    const [showPrintTabModal, setShowPrintTabModal] = useState(false);
    const printWindowRef = useRef(null);

    
    const [showQrModal, setShowQrModal] = useState(false);
    const [qrLoading, setQrLoading] = useState(false);
    const [qrError, setQrError] = useState('');
    const videoRef = useRef(null);
    const streamRef = useRef(null);

    
    const stats = useMemo(() => {
        const totalProdutos = produtosSalvos.length;
        const produtosComPreco = produtosSalvos.filter(p => p.preco !== "Sem preço definido").length;

        const precoMedio = produtosComPreco > 0
            ? produtosSalvos
                .filter(p => p.preco !== "Sem preço definido")
                .reduce((acc, p) => {
                    const precoNum = parseFloat(p.preco.replace('R$', '').replace(',', '.').trim());
                    return acc + (isNaN(precoNum) ? 0 : precoNum);
                }, 0) / produtosComPreco
            : 0;

        const produtoRecente = produtosSalvos.length > 0
            ? produtosSalvos[0]
            : null;

        return {
            totalProdutos,
            produtosComPreco,
            precoMedio: precoMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            produtoRecente: produtoRecente?.nome || 'Nenhum'
        };
    }, [produtosSalvos]);

    const filteredProducts = useMemo(() => {
        let filtered = produtosSalvos.filter(product =>
            product.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.marca.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.codigo.includes(searchTerm)
        );

        filtered.sort((a, b) => {
            let aValue = a[sortBy];
            let bValue = b[sortBy];

            if (sortBy === 'preco') {
                aValue = parseFloat(a.preco.replace('R$', '').replace(',', '.').trim()) || 0;
                bValue = parseFloat(b.preco.replace('R$', '').replace(',', '.').trim()) || 0;
            }

            if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        return filtered;
    }, [produtosSalvos, searchTerm, sortBy, sortOrder]);

    
    const paginatedProducts = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        return filteredProducts.slice(startIndex, startIndex + pageSize);
    }, [filteredProducts, currentPage, pageSize]);

    const totalPages = Math.ceil(filteredProducts.length / pageSize);

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        alert("Link copiado para a área de transferência!");
    };

    const openQrModal = async () => {
    setShowQrModal(true);
    setQrLoading(true);
    setQrError("");

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "environment",
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });

        streamRef.current = stream;

        if (videoRef.current) {
            videoRef.current.srcObject = stream;

            videoRef.current.onloadedmetadata = async () => {
                await videoRef.current.play().catch(err => {
                    console.error("Erro ao dar play", err);
                });

                setQrLoading(false);
                startQrCodeScan();
            };
        }
    } catch (error) {
        console.error(error);
        setQrError("Erro ao acessar câmera.");
        setQrLoading(false);
    }
};

    const startQrCodeScan = async () => {
    try {
        if (!videoRef.current) return;

        setQrLoading(true);
        setQrError("");

        // --- 1) Ativa a câmera corretamente ---
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "environment",
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });

        streamRef.current = stream;
        videoRef.current.srcObject = stream;

        // Necessário para evitar tela preta
        await videoRef.current.play();

        // Importa leitor ZXing
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const codeReader = new BrowserMultiFormatReader();

        setQrLoading(false);

        // --- 2) Loop de leitura contínua ---
        const scanLoop = async () => {
            if (!showQrModal) return;

            try {
                const result = await codeReader.decodeOnce(videoRef.current);

                if (result) {
                    const code = result.getText().trim();
                    console.log("Código detectado:", code);

                    // Aceita EAN8, EAN13, UPC-A, UPC-E (8–14 dígitos)
                    if (/^\d{8,14}$/.test(code)) {
                        setCodigo(code);
                        closeQrModal();

                        setTimeout(() => onBuscarProduto(), 150);
                        return; // PARA o loop
                    } else {
                        setQrError("Código inválido.");
                    }
                }
            } catch (err) {
                // Sem código → continua o loop
            }

            requestAnimationFrame(scanLoop);
        };

        scanLoop();

    } catch (err) {
        console.error("Erro no scanner:", err);
        setQrError("Erro ao iniciar scanner.");
        setQrLoading(false);
    }
};



    const closeQrModal = () => {
    setShowQrModal(false);
    setQrLoading(false);
    setQrError("");

    // Para a câmera
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    }

    if (videoRef.current) {
        videoRef.current.srcObject = null;
    }
};

    useEffect(() => {
    console.log("Código atualizado:", codigo);
}, [codigo]);

    useEffect(() => {
    return () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => {
                track.stop();
            });
            streamRef.current = null;
        }
    };
}, []);

    const openPrintModal = () => {
        if (produtosSalvos.length === 0) {
            alert("Nenhum produto para imprimir!");
            return;
        }
        setShowPrintModal(true);
        setCurrentPrintModal(1);
        setSelectedFormat('2-col');
        setSelectedInfo({
            codigo: true,
            nome: true,
            marca: true,
            descricao: true,
            preco: true,
            imagem: true
        });
    };

    const closePrintModal = () => {
        setShowPrintModal(false);
        setCurrentPrintModal(1);
        setSelectedFormat('');
    };

    const handleFormatSelect = (format) => {
        setSelectedFormat(format);
    };

    const handleNextModal = () => {
        if (!selectedFormat) {
            alert("Por favor, selecione um formato de impressão!");
            return;
        }
        setCurrentPrintModal(2);
    };

    const handleInfoToggle = (info) => {
        if (info === 'preco') return;
        setSelectedInfo(prev => ({
            ...prev,
            [info]: !prev[info]
        }));
    };

    const handleConfirmPrint = () => {
        if (!selectedInfo.preco) {
            alert("O preço é obrigatório para impressão!");
            return;
        }
        handleImprimirLista();
        closePrintModal();
    };

    const handleCancelPrint = () => {
        closePrintModal();
    };

    
    const checkPrintWindow = () => {
        if (printWindowRef.current && !printWindowRef.current.closed) {
            setShowPrintTabModal(true);
        }
    };
    useEffect(() => {
        let interval;
        if (printWindowRef.current) {
            interval = setInterval(() => {
                if (printWindowRef.current && !printWindowRef.current.closed) {
                    setShowPrintTabModal(true);
                } else {
                    setShowPrintTabModal(false);
                    clearInterval(interval);
                }
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [printWindowRef.current]);

    const closePrintTab = () => {
        if (printWindowRef.current && !printWindowRef.current.closed) {
            printWindowRef.current.close();
        }
        setShowPrintTabModal(false);
    };

    const handleImprimirLista = () => {
    const janelaImpressao = window.open('', '_blank');
    printWindowRef.current = janelaImpressao;
    
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    const horaAtual = new Date().toLocaleTimeString('pt-BR');

    let numColunas = 1;
    if (selectedFormat === '2-col') {
        numColunas = 2;
    } else if (selectedFormat === '3-col') {
        numColunas = 3;
    }

    
    const buildProductHtml = (produto) => `
        <div class="product-card">
            ${selectedInfo.codigo ? `
                <div class="product-code">
                    <span>CÓDIGO:</span>
                    <span>${produto.codigo}</span>
                </div>
            ` : ''}

            <div class="product-content ${selectedInfo.imagem && produto.imagem ? 'with-image' : ''}">
                <div class="product-info">
                    ${selectedInfo.nome ? `
                        <div class="product-field">
                            <label>Nome:</label>
                            <p>${produto.nome || 'Não informado'}</p>
                        </div>
                    ` : ''}

                    <div class="details-grid" style="display: grid; grid-template-columns: ${selectedInfo.marca && selectedInfo.preco ? '1fr 1fr' : '1fr'}; gap: 0.5rem;">
                        ${selectedInfo.marca ? `
                            <div class="product-field">
                                <label>Marca:</label>
                                <p>${produto.marca || 'Não informada'}</p>
                            </div>
                        ` : ''}

                        ${selectedInfo.preco ? `
                            <div class="product-field">
                                <label>Preço:</label>
                                <p class="product-price">${produto.preco || 'Sem preço definido'}</p>
                            </div>
                        ` : ''}
                    </div>

                    ${selectedInfo.descricao && produto.descricao ? `
                        <div class="product-field">
                            <label>Descrição:</label>
                            <p class="product-description">${produto.descricao}</p>
                        </div>
                    ` : ''}
                </div>

                ${selectedInfo.imagem ? `
                    <div class="product-image-container">
                        ${produto.imagem ? `
                            <img src="${produto.imagem}" 
                                 alt="${produto.nome}" 
                                 class="product-image" />
                        ` : `
                            <div class="no-image-placeholder">Sem imagem</div>
                        `}
                    </div>
                ` : ''}
            </div>
        </div>`;

    janelaImpressao.document.write(`
<!DOCTYPE html>
<html>
<head>
    <title>Lista de Produtos - ${dataAtual}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: Arial, sans-serif;
            color: #333;
            background: white;
            line-height: 1.4;
            width: 100%;
        }

        .container {
            width: 100%;
            margin: 0 auto;
            padding: 1.5rem;
        }

        .header {
            text-align: center;
            border-bottom: 2px solid #000000ff;
            padding-bottom: 1rem;
            margin-bottom: 1.5rem;
            width: 100%;
        }

        .header h1 {
            font-size: 1.875rem;
            font-weight: bold;
            color: #111827;
            margin-bottom: 0.5rem;
        }

        .header-info {
            display: flex;
            justify-content: center;
            gap: 2rem;
            font-size: 0.75rem;
            color: #6b7280;
            margin-top: 0.5rem;
        }

        .products-container {
    display: grid;
    gap: 1rem;
}

${numColunas === 1 ? `
.products-container {
    grid-template-columns: 1fr;
}
` : ''}

${numColunas === 2 ? `
.products-container {
    grid-template-columns: repeat(2, 1fr);
}
` : ''}

${numColunas === 3 ? `
.products-container {
    grid-template-columns: repeat(3, 1fr);
}
` : ''}
    
.product-card {
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    padding: 1rem;
    background: white;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
}


        .product-code {
            background-color: #f3f4f6;
            padding: 0.5rem 0.1rem;
            border-radius: 0.375rem;
            margin-bottom: 0.75rem;
            font-family: monospace;
        }

        .product-code span:first-child {
            font-size: 0.75rem;
            font-weight: 600;
            color: #374151;
        }

        .product-code span:last-child {
            font-size: 0.875rem;
            font-weight: bold;
            color: #111827;
            margin-left: 0.5rem;
        }

        .product-content {
            display: flex;
            gap: 0.75rem;
            flex: 1;
        }

        .product-content.with-image {
            justify-content: space-between;
        }

        .product-info {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            flex: 1;
            min-width: 0;
        }

        .product-field {
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
        }

        .product-field label {
            font-weight: 600;
            color: #374151;
            font-size: 0.75rem;
            text-transform: uppercase;
        }

        .product-field p {
            color: #111827;
            font-size: 0.875rem;
            margin: 0;
            word-break: break-word;
        }

        .product-price {
            color: #16a34a;
            font-weight: bold;
            font-size: 0.9rem;
        }

        .product-description {
            font-size: 0.75rem;
            color: #6b7280;
            line-height: 1.25;
        }

        .product-image-container {
            display: flex;
            justify-content: center;
            align-items: flex-start;
            min-width: 80px;
            flex-shrink: 0;
        }

        .product-image {
            max-height: 80px;
            max-width: 80px;
            object-fit: contain;
            border: 1px solid #d1d5db;
            border-radius: 0.375rem;
            padding: 0.25rem;
        }

        .no-image-placeholder {
            width: 80px;
            height: 80px;
            background-color: #f3f4f6;
            border: 1px solid #d1d5db;
            border-radius: 0.375rem;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #6b7280;
            font-size: 0.625rem;
            text-align: center;
        }

        .footer {
            border-top: 2px solid #1f2937;
            margin-top: 1.5rem;
            padding-top: 0.75rem;
            text-align: center;
            font-size: 0.75rem;
            color: #6b7280;
            width: 100%;
        }

        @media print {
            @page {
                margin: 1cm;
                size: A4;
            }
            body {
                margin: 0;
                padding: 0;
                width: 100%;
            }
            .container {
                width: 100%;
                padding: 0;
            }
            .product-card {
                page-break-inside: avoid;
                break-inside: avoid;
            }
            
            ${numColunas === 2 ? `
                .products-container {
                    column-count: 2 !important;
                }
            ` : ''}
            
            ${numColunas === 3 ? `
                .products-container {
                    column-count: 3 !important;
                }
            ` : ''}
        }

        @media (max-width: 480px) {
            .products-container {
                column-count: 1 !important;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Lista de Produtos</h1>
            <div class="header-info">
                <span>Data: ${dataAtual}</span>
                <span>Hora: ${horaAtual}</span>
                <span>Total: ${produtosSalvos.length} itens</span>
                <span>Formato: ${numColunas} coluna(s)</span>
            </div>
        </div>

        <div class="products-container">
            ${produtosSalvos.map(prod => buildProductHtml(prod)).join('')}
        </div>

        <div class="footer">
            <p>Relatório gerado automaticamente por ConsulteJá</p>
            <p>${dataAtual} às ${horaAtual} • ${produtosSalvos.length} itens listados</p>
        </div>
    </div>

    <script>
        window.onload = function() {
            window.print();
        }
    </script>
</body>
</html>
`);

    janelaImpressao.document.close();
    

    setTimeout(() => checkPrintWindow(), 2000);
};

    
    const QrCodeModal = () => {
        if (!showQrModal) return null;

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg max-w-md w-full">
                    <div className="flex justify-between items-center border-b border-gray-200 px-6 py-4">
                        <h3 className="text-lg font-semibold text-gray-900">Ler Código de Barras</h3>
                        <button
                            onClick={closeQrModal}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="p-6">
                        {qrError ? (
                            <div className="text-center py-8">
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                                    <p className="text-red-800 text-sm">{qrError}</p>
                                </div>
                                <button
                                    onClick={openQrModal}
                                    className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                                >
                                    Tentar Novamente
                                </button>
                            </div>
                        ) : (
                            <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
    <video
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline
        autoPlay
        muted
    />
    {qrLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="text-white text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                <p className="text-sm">Iniciando câmera...</p>
            </div>
        </div>
    )}
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="border-2 border-white border-dashed w-64 h-32 rounded-lg opacity-60"></div>
    </div>
</div>
                        )}
                    </div>

                    <div className="flex justify-end border-t border-gray-200 px-6 py-4">
                        <button
                            onClick={closeQrModal}
                            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const PrintModal = () => {
        if (!showPrintModal) return null;

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center border-b border-gray-200 px-6 py-4">
                        <h3 className="text-lg font-semibold text-gray-900">
                            {currentPrintModal === 1 ? 'Formato de Impressão' : 'Informações do Produto'}
                        </h3>
                        <button
                            onClick={closePrintModal}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="p-6">
                        {currentPrintModal === 1 ? (
                            <div className="space-y-4">
                                <p className="text-sm text-gray-600 mb-4">
                                    Escolha o formato de exibição dos produtos na impressão:
                                </p>

                                <div className="space-y-3">
                                    <label className="flex items-start space-x-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                        <input
                                            type="radio"
                                            name="printFormat"
                                            value="1-col"
                                            checked={selectedFormat === '1-col'}
                                            onChange={() => handleFormatSelect('1-col')}
                                            className="mt-0.5 text-black focus:ring-black"
                                        />
                                        <div className="flex-1">
                                            <span className="font-medium text-gray-900">1 produto por fileira</span>
                                            <p className="text-sm text-gray-500 mt-1">
                                                Layout vertical com um produto por linha
                                            </p>
                                        </div>
                                    </label>

                                    <label className="flex items-start space-x-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                        <input
                                            type="radio"
                                            name="printFormat"
                                            value="2-col"
                                            checked={selectedFormat === '2-col'}
                                            onChange={() => handleFormatSelect('2-col')}
                                            className="mt-0.5 text-black focus:ring-black"
                                        />
                                        <div className="flex-1">
                                            <span className="font-medium text-gray-900">2 produtos por fileira</span>
                                            <p className="text-sm text-gray-500 mt-1">
                                                Layout balanceado com dois produtos por linha
                                            </p>
                                        </div>
                                    </label>

                                    <label className="flex items-start space-x-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                        <input
                                            type="radio"
                                            name="printFormat"
                                            value="3-col"
                                            checked={selectedFormat === '3-col'}
                                            onChange={() => handleFormatSelect('3-col')}
                                            className="mt-0.5 text-black focus:ring-black"
                                        />
                                        <div className="flex-1">
                                            <span className="font-medium text-gray-900">3 produtos por fileira</span>
                                            <p className="text-sm text-gray-500 mt-1">
                                                Layout compacto com três produtos por linha
                                            </p>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <p className="text-sm text-gray-600 mb-4">
                                    Selecione quais informações dos produtos devem aparecer na impressão:
                                </p>

                                <div className="space-y-3">
                                    {Object.entries(selectedInfo).map(([key, value]) => (
                                        <label key={key} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                            <div className="flex items-center space-x-3">
                                                <input
                                                    type="checkbox"
                                                    checked={value}
                                                    onChange={() => handleInfoToggle(key)}
                                                    disabled={key === 'preco'}
                                                    className="text-black focus:ring-black disabled:opacity-50 disabled:cursor-not-allowed"
                                                />
                                                <span className={`font-medium ${key === 'preco' ? 'text-gray-900' : 'text-gray-700'}`}>
                                                    {key === 'codigo' && 'Código do Produto'}
                                                    {key === 'nome' && 'Nome do Produto'}
                                                    {key === 'marca' && 'Marca'}
                                                    {key === 'descricao' && 'Descrição'}
                                                    {key === 'preco' && 'Preço (obrigatório)'}
                                                    {key === 'imagem' && 'Imagem'}
                                                </span>
                                            </div>
                                            {key === 'preco' && (
                                                <span className="text-xs text-red-600 font-medium">Obrigatório</span>
                                            )}
                                        </label>
                                    ))}
                                </div>

                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-4">
                                    <p className="text-sm text-yellow-800">
                                        <strong>Atenção:</strong> O campo Preço é obrigatório e não pode ser desativado.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-between items-center border-t border-gray-200 px-6 py-4">
                        {currentPrintModal === 1 ? (
                            <>
                                <button
                                    onClick={closePrintModal}
                                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleNextModal}
                                    disabled={!selectedFormat}
                                    className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Avançar
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={() => setCurrentPrintModal(1)}
                                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                                >
                                    Voltar
                                </button>
                                <div className="space-x-2">
                                    <button
                                        onClick={handleCancelPrint}
                                        className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleConfirmPrint}
                                        className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                                    >
                                        Confirmar e Imprimir
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const PrintTabModal = () => {
        if (!showPrintTabModal) return null;

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg max-w-md w-full">
                    <div className="flex justify-between items-center border-b border-gray-200 px-6 py-4">
                        <h3 className="text-lg font-semibold text-gray-900">Guia de Impressão Aberta</h3>
                        <button
                            onClick={() => setShowPrintTabModal(false)}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                    
                    <div className="p-6">
                        <p className="text-sm text-gray-600 mb-4">
                            A guia de impressão ainda está aberta. Para continuar usando o site normalmente, 
                            feche a guia de impressão ou use o botão abaixo para fechá-la automaticamente.
                        </p>
                        
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                            <p className="text-sm text-blue-800">
                                <strong>Dica:</strong> Você pode voltar a usar o site normalmente após fechar a guia de impressão.
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-end space-x-3 border-t border-gray-200 px-6 py-4">
                        <button
                            onClick={() => setShowPrintTabModal(false)}
                            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                        >
                            Continuar Usando o Site
                        </button>
                        <button
                            onClick={closePrintTab}
                            className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                        >
                            Fechar Guia de Impressão
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-white">
            {/* Header */}
            <header className="bg-black border-b border-gray-800">
                <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center space-x-2 sm:space-x-3">
                            <Package className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">ConsulteJá</h1>
                        </div>
                        
                        <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-3">
                            {/* Botão do Leitor de QR Code */}
                            <button
                                onClick={openQrModal}
                                className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 border border-gray-600 text-white rounded-lg hover:bg-gray-800 transition-colors text-xs sm:text-sm"
                                title="Ler código de barras com a câmera"
                            >
                                <QrCode className="h-3 w-3 sm:h-4 sm:w-4" />
                                <span className="hidden sm:inline">Ler Código</span>
                            </button>

                            <button
                                onClick={openPrintModal}
                                disabled={produtosSalvos.length === 0}
                                className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 border border-gray-600 text-white rounded-lg hover:bg-gray-800 transition-colors text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Imprimir lista de produtos"
                            >
                                <Printer className="h-3 w-3 sm:h-4 sm:w-4" />
                                <span className="hidden sm:inline">Imprimir Lista</span>
                            </button>

                            <button
                                onClick={onGerarArquivoJSON}
                                className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 border border-gray-600 text-white rounded-lg hover:bg-gray-800 transition-colors text-xs sm:text-sm"
                            >
                                <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                                <span className="hidden sm:inline">Exportar</span>
                            </button>

                            <button
                                onClick={onGerarLinkAPI}
                                className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors font-medium text-xs sm:text-sm"
                            >
                                <Link className="h-3 w-3 sm:h-4 sm:w-4" />
                                <span className="hidden sm:inline">Gerar API</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <QrCodeModal />
            <PrintModal />
            <PrintTabModal />
            
            {alertMessage && (
                <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        {alertMessage}
                    </div>
                </div>
            )}

            {apiLink && (
                <div className="bg-green-50 border-l-4 border-green-500 p-4">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-green-800 font-medium">Link da API gerado com sucesso!</p>
                                <p className="text-green-600 text-sm">Use este link para acessar seus produtos via API</p>
                            </div>
                            <button
                                onClick={() => copyToClipboard(apiLink)}
                                className="flex items-center space-x-2 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
                            >
                                <Copy className="h-3 w-3" />
                                <span>Copiar</span>
                            </button>
                        </div>
                        <div className="mt-2">
                            <input
                                type="text"
                                readOnly
                                value={apiLink}
                                className="w-full px-3 py-2 bg-white border border-green-300 rounded text-sm text-green-800 font-mono"
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <SearchSection
                            codigo={codigo}
                            setCodigo={setCodigo}
                            produto={produto}
                            loading={loading}
                            precoCustom={precoCustom}
                            nomeTemp={nomeTemp}
                            setNomeTemp={setNomeTemp}
                            marcaTemp={marcaTemp}
                            setMarcaTemp={setMarcaTemp}
                            descricaoTemp={descricaoTemp}
                            setDescricaoTemp={setDescricaoTemp}
                            editandoNome={editandoNome}
                            editandoMarca={editandoMarca}
                            editandoDescricao={editandoDescricao}
                            inputRef={inputRef}
                            onBuscarProduto={onBuscarProduto}
                            onKeyPress={onKeyPress}
                            onImageUpload={onImageUpload}
                            onRemoverImagem={onRemoverImagem}
                            onIniciarEdicaoNome={onIniciarEdicaoNome}
                            onIniciarEdicaoMarca={onIniciarEdicaoMarca}
                            onIniciarEdicaoDescricao={onIniciarEdicaoDescricao}
                            onConfirmarEdicao={onConfirmarEdicao}
                            onCancelarEdicao={onCancelarEdicao}
                            onSalvarProduto={onSalvarProduto}
                            onPrecoChange={onPrecoChange}
                        />
                    </div>

                    
                    <div className="space-y-6">
                        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                                <BarChart3 className="h-5 w-5 text-gray-700" />
                                <span>Estatísticas</span>
                            </h2>
                            <div className="grid grid-cols-2 gap-4">
                                <StatsCard
                                    title="Total de Produtos"
                                    value={stats.totalProdutos}
                                    icon={<Package className="h-4 w-4" />}
                                />
                                <StatsCard
                                    title="Com Preço"
                                    value={stats.produtosComPreco}
                                    icon={<DollarSign className="h-4 w-4" />}
                                />
                                <StatsCard
                                    title="Preço Médio"
                                    value={`R$ ${stats.precoMedio}`}
                                    icon={<BarChart3 className="h-4 w-4" />}
                                />
                                <div className="break-words">
                                    <StatsCard
                                        title="Mais Recente"
                                        value={stats.produtoRecente}
                                        icon={<Calendar className="h-4 w-4" />}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                                <Upload className="h-5 w-5 text-gray-700" />
                                <span>Importar Dados</span>
                            </h2>
                            <UploadConverter onProductsImported={onSalvarProdutosLocal} />
                        </div>

                        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                                <History className="h-5 w-5 text-gray-700" />
                                <span>Histórico de Pesquisas</span>
                            </h2>
                            <HistoryList historico={historicoPesquisas} />
                        </div>
                    </div>
                </div>

                <div className="mt-8 bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-4 sm:space-y-0">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">Produtos Salvos</h2>
                            <p className="text-sm text-gray-600 mt-1">
                                {filteredProducts.length} produto(s) encontrado(s)
                                {produtosSalvos.some(p => p.isInitial) && (
                                    <span className="ml-2 text-blue-600 text-xs bg-blue-50 px-2 py-1 rounded">
                                        Inclui produtos demonstrativos
                                    </span>
                                )}
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
                            <div className="relative flex-1 sm:flex-none sm:w-64">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar produtos..."
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                                />
                            </div>

                            <select
                                value={sortBy}
                                onChange={(e) => {
                                    setSortBy(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                            >
                                <option value="nome">Nome</option>
                                <option value="marca">Marca</option>
                                <option value="preco">Preço</option>
                            </select>

                            <button
                                onClick={() => {
                                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                    setCurrentPage(1);
                                }}
                                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                <ArrowUpDown className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {paginatedProducts.length > 0 ? (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-6">
                                {paginatedProducts.map((product) => (
                                    <ProductCard
                                        key={product.codigo}
                                        product={product}
                                        onExcluir={onExcluirProduto}
                                    />
                                ))}
                            </div>

                            {totalPages > 1 && (
                                <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0 border-t border-gray-200 pt-6">
                                    <div className="flex items-center space-x-2">
                                        <span className="text-sm text-gray-600">Itens por página:</span>
                                        <select
                                            value={pageSize}
                                            onChange={(e) => {
                                                setPageSize(Number(e.target.value));
                                                setCurrentPage(1);
                                            }}
                                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                                        >
                                            <option value={4}>4</option>
                                            <option value={8}>8</option>
                                            <option value={12}>12</option>
                                            <option value={16}>16</option>
                                        </select>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                            disabled={currentPage === 1}
                                            className="px-4 py-2 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                                        >
                                            Anterior
                                        </button>

                                        <span className="text-sm text-gray-600 mx-4">
                                            Página {currentPage} de {totalPages}
                                        </span>

                                        <button
                                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                            disabled={currentPage === totalPages}
                                            className="px-4 py-2 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                                        >
                                            Próxima
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-12">
                            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-500">Nenhum produto encontrado</p>
                            <p className="text-sm text-gray-400 mt-1">
                                {searchTerm ? "Tente ajustar os termos de busca" : "Adicione produtos usando a consulta acima"}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;