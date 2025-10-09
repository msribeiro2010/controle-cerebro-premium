const { NormalizadorTexto } = require('../../utils/normalizacao');

describe('NormalizadorTexto', () => {
    describe('extrairNumeros', () => {
        test('deve extrair apenas números de um texto', () => {
            expect(NormalizadorTexto.extrairNumeros('123.456.789-10')).toBe('12345678910');
            expect(NormalizadorTexto.extrairNumeros('abc123def456')).toBe('123456');
            expect(NormalizadorTexto.extrairNumeros('12345678910')).toBe('12345678910');
            expect(NormalizadorTexto.extrairNumeros('texto sem números')).toBe('');
        });

        test('deve retornar string vazia para entrada inválida', () => {
            expect(NormalizadorTexto.extrairNumeros(null)).toBe('');
            expect(NormalizadorTexto.extrairNumeros(undefined)).toBe('');
            expect(NormalizadorTexto.extrairNumeros('')).toBe('');
            expect(NormalizadorTexto.extrairNumeros(123)).toBe('');
        });
    });

    describe('formatarCPF', () => {
        test('deve formatar CPF corretamente', () => {
            expect(NormalizadorTexto.formatarCPF('12345678910')).toBe('123.456.789-10');
            expect(NormalizadorTexto.formatarCPF('123.456.789-10')).toBe('123.456.789-10');
        });

        test('deve retornar original se não tiver 11 dígitos', () => {
            expect(NormalizadorTexto.formatarCPF('123456789')).toBe('123456789');
            expect(NormalizadorTexto.formatarCPF('123456789101')).toBe('123456789101');
        });

        test('deve retornar string vazia para entrada inválida', () => {
            expect(NormalizadorTexto.formatarCPF(null)).toBe('');
            expect(NormalizadorTexto.formatarCPF(undefined)).toBe('');
            expect(NormalizadorTexto.formatarCPF('')).toBe('');
        });
    });
});