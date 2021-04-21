FROM node
ENV NPM_CONFIG_LOGLEVEL warn
EXPOSE 3000

#
# Sometimes the host user's id doesn't align with the container user's id.
# If there are any permission errors, this is one likely cause
#
RUN usermod -u 1001 node

RUN wget -O csv2odf_2.09-1.deb https://sourceforge.net/projects/csv2odf/files/csv2odf-2.09/csv2odf_2.09-1.deb/download
RUN dpkg -i csv2odf_2.09-1.deb

USER node
ENV HOME=/home/node
ENV LANG en_CA.UTF-8
ENV LANGUAGE en_CA.UTF-8

WORKDIR $HOME

ENV PATH $HOME/app/node_modules/.bin:$PATH

ADD package.json $HOME
RUN NODE_ENV=production npm install

CMD ["node", "./app.js"]
