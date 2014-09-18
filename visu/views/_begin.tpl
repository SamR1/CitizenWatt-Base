<!DOCTYPE html>
<html>
    <head>
        <meta charset="utf-8">
        <title>CitizenWatt — {{ title }}</title>
        <link rel="stylesheet" href="{{ get_url('static', filename='css/normalize.css') }}">
        <link rel="stylesheet" href="{{ get_url('static', filename='css/style.css') }}">
    </head>

    <body>
        <div id="page">
            <header>
                <a href="index.html"><img src="{{ get_url('static', filename='img/logo.png') }}" alt="Logo CitizenWatt"/></a>

                <nav id="menu">
                    <a {{ !'class="active"' if page=='home' else '' }} href="{{ get_url('index') }}">Accueil</a>
                    <a {{ !'class="active"' if page=='conso' else '' }} href="{{ get_url('conso') }}">Conso</a>
                    <a {{ !'class="active"' if page=='target' else '' }} href="">Objectifs</a>
                    <a {{ !'class="active"' if page=='help' else '' }} href="">Guide</a>
                    <a {{ !'class="active"' if page=='results' else '' }} href="">Bilan</a>
                </nav>
            </header>