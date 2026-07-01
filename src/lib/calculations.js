// Cálculos de progresso ("sobras") até a meta do aluno.
// "Sobra" = quanto ainda falta percorrer até a meta definida pela treinadora.

export function calcSobraPeso(pesoAtual, pesoMeta) {
  if (pesoAtual == null || pesoMeta == null) return null
  const diff = pesoAtual - pesoMeta
  return Number(diff.toFixed(1)) // positivo = precisa perder, negativo = abaixo da meta
}

export function calcSobraGordura(gorduraAtual, gorduraMeta) {
  if (gorduraAtual == null || gorduraMeta == null) return null
  const diff = gorduraAtual - gorduraMeta
  return Number(diff.toFixed(1))
}

export function calcProgressoPercentual(valorInicial, valorAtual, valorMeta) {
  if ([valorInicial, valorAtual, valorMeta].some((v) => v == null)) return null
  const total = valorInicial - valorMeta
  if (total === 0) return 100
  const feito = valorInicial - valorAtual
  const pct = (feito / total) * 100
  return Math.max(0, Math.min(100, Number(pct.toFixed(1))))
}

export function calcIMC(pesoKg, alturaM) {
  if (!pesoKg || !alturaM) return null
  return Number((pesoKg / (alturaM * alturaM)).toFixed(1))
}

export function classificaIMC(imc) {
  if (imc == null) return ''
  if (imc < 18.5) return 'Abaixo do peso'
  if (imc < 25) return 'Peso normal'
  if (imc < 30) return 'Sobrepeso'
  if (imc < 35) return 'Obesidade grau I'
  if (imc < 40) return 'Obesidade grau II'
  return 'Obesidade grau III'
}
