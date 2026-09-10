import * as React from 'react'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'

import {
  brandName,
  codeStyle,
  container,
  darkModeCss,
  footer,
  h1,
  main,
  text,
} from './brand'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>Seu código de verificação</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brandName}>MCB</Text>
        <Heading style={h1}>Seu código de verificação</Heading>
        <Text style={text}>Use o código abaixo para confirmar sua identidade:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          Se você não solicitou este código, pode ignorar este e-mail com segurança.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail
