FROM debian:stretch
RUN apt-get update -q -q && apt-get upgrade --yes && apt-get autoclean --yes

RUN apt-get install --yes \
  autoconf2.13 \
  build-essential \
  ccache \
  python-dev \
  python-pip \
  python-setuptools \
  unzip \
  uuid \
  zip

RUN apt-get install --yes \
  libasound2-dev \
  libcurl4-openssl-dev \
  libdbus-1-dev \
  libdbus-glib-1-dev \
  libgconf2-dev \
  libgtk-3-dev \
  libgtk2.0-dev \
  libiw-dev \
  libnotify-dev \
  libpulse-dev \
  libx11-xcb-dev \
  libxt-dev \
  mesa-common-dev \
  python-dbus \
  xvfb \
  yasm

RUN mkdir /moz
RUN curl -s https://archive.mozilla.org/pub/firefox/releases/52.6.0esr/source/firefox-52.6.0esr.source.tar.xz \
  | tar xJf - -C /moz/ \
  && mv /moz/firefox-52.6.0esr /moz/source
WORKDIR /moz/source

RUN echo ' \
mk_add_options MOZ_MAKE_FLAGS="-j4" \n\
' > /root/mozconfig
ENV MOZCONFIG /root/mozconfig

ENV SHELL /bin/sh
RUN mkdir -p /root/.mozbuild
ENV MOZBUILD_STATE_PATH /root/.mozbuild

# uncomment for checking what needs to be installed
# RUN apt-get install --yes mercurial
# RUN bash -c './mach bootstrap < <(echo 2; echo 2; echo)'

RUN ./mach build
