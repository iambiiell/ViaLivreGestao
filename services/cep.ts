
export interface CepData {
  addressStreet: string;
  addressNeighborhood: string;
  addressCity: string;
  addressState: string;
  ibge?: string; // Adicionado código IBGE
}

export const fetchAddress = async (cep: string): Promise<CepData | null> => {
  // Remove caracteres especiais
  const cleanCep = cep.replace(/\D/g, '');
  
  // Valida se tem 8 dígitos
  if (cleanCep.length !== 8) return null;

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
    const data = await response.json();
    
    if (data.erro) return null;

    // Mapeamento de Campos
    return {
      addressStreet: data.logradouro,
      addressNeighborhood: data.bairro,
      addressCity: data.localidade,
      addressState: data.uf,
      ibge: data.ibge // Retorna o código IBGE
    };
  } catch (error) {
    console.error("Erro ao buscar CEP:", error);
    return null;
  }
};

// Mantendo compatibilidade com código antigo se necessário
export const fetchAddressByCep = async (cep: string) => {
    const res = await fetchAddress(cep);
    if (!res) return null;
    return {
        logradouro: res.addressStreet,
        bairro: res.addressNeighborhood,
        localidade: res.addressCity,
        uf: res.addressState,
        ibge: res.ibge
    };
}
