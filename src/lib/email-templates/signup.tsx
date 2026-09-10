import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from '@react-email/components'

import {
  brandName,
  button,
  container,
  darkModeCss,
  footer,
  h1,
  link,
  main,
  text,
} from './brand'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>Confirme seu e-mail para acessar o {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brandName}>{siteName}</Text>
        <Heading style={h1}>Confirme seu e-mail</Heading>
        <Text style={text}>
          Obrigada por se cadastrar no{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          !
        </Text>
        <Text style={text}>
          Para ativar sua conta (
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ), clique no botão abaixo:
        </Text>
        <Button className="dm-btn" style={button} href={confirmationUrl}>
          Confirmar e-mail
        </Button>
        <Text style={footer}>
          Se você não criou uma conta, pode ignorar este e-mail com segurança.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail
