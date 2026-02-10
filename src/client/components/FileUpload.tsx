import { useState } from 'react';

export default function FileUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Por favor, selecione um arquivo');
      return;
    }

    setUploading(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload-file', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setResult(data.data);
      } else {
        setError(data.error || 'Erro ao processar arquivo');
      }
    } catch (err) {
      setError('Erro de conexão: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="card">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">📁 Upload de Arquivo com Dados Hex</h2>
      <p className="text-gray-600 mb-4">
        Faça upload de um arquivo (txt, log, json, etc.) e o sistema extrairá automaticamente todos os dados hexadecimais
      </p>

      <div className="space-y-4">
        <div>
          <input
            type="file"
            accept=".txt,.log,.json,.csv,.dat"
            onChange={handleFileChange}
            className="w-full px-4 py-3 border-2 border-dashed border-blue-300 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer"
          />
          <p className="text-sm text-gray-500 mt-2">
            Formatos suportados: TXT, LOG, JSON, CSV, DAT
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="btn-primary disabled:opacity-50"
          >
            {uploading ? '⏳ Processando...' : '📤 Processar Arquivo'}
          </button>
          <button
            onClick={() => {
              setFile(null);
              setResult(null);
              setError('');
            }}
            className="btn-secondary"
          >
            🗑️ Limpar
          </button>
        </div>

        {result && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <h3 className="font-bold text-green-800 mb-3">📊 Resultado do Processamento</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <div className="text-sm text-gray-600">Arquivo</div>
                <div className="font-semibold">{file?.name}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Hex Encontrados</div>
                <div className="font-semibold text-blue-600">{result.totalHexFound}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Decodificados</div>
                <div className="font-semibold text-green-600">{result.successfullyDecoded}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Salvos no Banco</div>
                <div className="font-semibold text-green-600">{result.savedToDatabase}</div>
              </div>
            </div>

            {/* Fuel Data Summary */}
            {result.fuelDataSummary && (
              <div className="mt-4 pt-4 border-t border-green-300">
                <h4 className="font-semibold text-green-800 mb-2">⛽ Dados de Combustível Extraídos</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-gray-600">Leituras com Combustível</div>
                    <div className="font-semibold text-blue-600">
                      {result.fuelDataSummary.readingsWithFuel}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600">Dispositivos Únicos</div>
                    <div className="font-semibold">
                      {result.fuelDataSummary.uniqueDevices}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600">Total Consumido</div>
                    <div className="font-semibold text-orange-600">
                      {result.fuelDataSummary.totalConsumed.toFixed(1)}L
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600">Nível Médio</div>
                    <div className="font-semibold text-green-600">
                      {result.fuelDataSummary.averageLevel.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800">
            <h3 className="font-bold mb-2">❌ Erro no Processamento</h3>
            <p>{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
