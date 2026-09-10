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

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>Confirme seu novo e-mail no {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brandName}>{siteName}</Text>
        <Heading style={h1}>Confirme seu novo e-mail</Heading>
        <Text style={text}>
          Você pediu para alterar o e-mail da sua conta de{' '}
          <Link href={`mailto:${oldEmail}`} style={link}>
            {oldEmail}
          </Link>{' '}
          para{' '}
          <Link href={`mailto:${newEmail}`} style={link}>
            {newEmail}
          </Link>
          .
        </Text>
        <Text style={text}>Para concluir a alteração, clique no botão abaixo:</Text>
        <Button className="dm-btn" style={button} href={confirmationUrl}>
          Confirmar novo e-mail
        </Button>
        <Text style={footer}>
          Se você não pediu essa alteração, entre em contato com sua gestora e
          ignore este e-mail.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail
